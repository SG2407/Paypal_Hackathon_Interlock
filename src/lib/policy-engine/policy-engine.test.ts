/**
 * Policy Engine Tests
 *
 * Tests the deterministic authorization engine with various scenarios.
 */

import { describe, it, expect } from 'vitest';
import { evaluatePolicy, validateOrderForCapture } from './index';
import { simulateUnauthorizedSubscription } from '@/lib/demo/simulate-drift';
import { PermissionPolicySchema, type PermissionPolicy } from '@/types/policy';
import type { Product, PurchaseSnapshot } from '@/types/product';
import type { PayPalAPIOrder } from '@/types/paypal';

// Test helper to create a base policy
function createBasePolicy(overrides: Partial<PermissionPolicy> = {}): PermissionPolicy {
  return {
    productCategory: 'headphones',
    requiredBrand: 'Sony',
    requiredAttributes: [],
    allowedCondition: 'new',
    maxBudgetCents: 17000, // $170 budget
    currency: 'USD',
    budgetIncludesShipping: true,
    budgetIncludesTax: true,
    deliveryDeadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(), // 1 week from now
    minQuantity: 1,
    maxQuantity: 1,
    allowSubscriptions: false,
    allowAddOns: false,
    allowSubstitutions: false,
    allowedMerchants: null,
    blockedMerchants: [],
    requireHumanApproval: true,
    expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(), // 30 days from now
    clarificationNeeded: [],
    approvedProducts: [],
    ...overrides,
  };
}

// Test helper to create a base product
function createBaseProduct(overrides: Partial<Product> = {}): Product {
  return {
    id: 'product-1',
    sku: 'SKU-12345',
    name: 'Sony WH-1000XM5 Wireless Noise-Canceling Headphones',
    brand: 'Sony',
    description: 'Premium wireless headphones with industry-leading noise cancellation',
    category: 'headphones',
    color: 'Black',
    condition: 'new',
    priceCents: 14999, // $149.99
    shippingCents: 799, // $7.99
    taxEstimateCents: 1200, // $12.00
    currency: 'USD',
    deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
    merchantId: 'merchant-1',
    merchantName: 'Electronics Hub',
    imageUrl: '/images/sony-headphones.jpg',
    attributes: {
      noiseCancelling: 'yes',
      wireless: 'yes',
      batteryLife: '30 hours',
    },
    hasSubscription: false,
    subscriptionInfo: null,
    ...overrides,
  };
}

// Test helper for PayPal order
function createPayPalOrder(
  totalCents: number,
  currency: string = 'USD',
  sku: string = 'SKU-12345',
  product: Product = createBaseProduct(),
): PayPalAPIOrder {
  return {
    id: 'paypal-order-123',
    status: 'APPROVED',
    intent: 'CAPTURE',
    purchase_units: [{
      reference_id: 'default',
      amount: {
        currency_code: currency,
        value: (totalCents / 100).toFixed(2),
        breakdown: {
          item_total: { currency_code: currency, value: (product.priceCents / 100).toFixed(2) },
          shipping: { currency_code: currency, value: ((product.shippingCents + totalCents - product.priceCents - product.shippingCents - product.taxEstimateCents) / 100).toFixed(2) },
          tax_total: { currency_code: currency, value: (product.taxEstimateCents / 100).toFixed(2) },
        },
      },
      items: [{
        name: product.name,
        sku: sku, // Include SKU to match product
        unit_amount: {
          currency_code: currency,
          value: (product.priceCents / 100).toFixed(2),
        },
        quantity: '1',
      }],
      custom_id: 'local-order-123',
    }],
    payer: {
      payer_id: 'payer-123',
      email_address: 'buyer@test.com',
    },
    create_time: new Date().toISOString(),
    update_time: new Date().toISOString(),
  };
}

// Test helper for purchase snapshot
function createPurchaseSnapshot(product: Product): PurchaseSnapshot {
  const totalCents = product.priceCents + product.shippingCents + product.taxEstimateCents;
  return {
    productId: product.id,
    productSku: product.sku,
    productName: product.name,
    productBrand: product.brand,
    productCondition: product.condition,
    priceCents: product.priceCents,
    shippingCents: product.shippingCents,
    taxEstimateCents: product.taxEstimateCents,
    totalCents,
    currency: product.currency,
    deliveryDate: product.deliveryDate,
    merchantId: product.merchantId,
    merchantName: product.merchantName,
    quantity: 1,
    hasSubscription: product.hasSubscription,
    subscriptionInfo: product.subscriptionInfo,
    snapshotCreatedAt: new Date().toISOString(),
  };
}

describe('Policy Engine', () => {
  it('preserves older policies without an allowed-brand list and rejects an empty list', () => {
    const oldPolicy = createBasePolicy();
    expect(PermissionPolicySchema.parse(oldPolicy).allowedBrands).toBeUndefined();
    expect(PermissionPolicySchema.safeParse({ ...oldPolicy, allowedBrands: [] }).success).toBe(false);
  });

  describe('evaluatePolicy', () => {
    describe('PASS scenarios', () => {
      it('should PASS a compliant product within budget', () => {
        const policy = createBasePolicy();
        const product = createBaseProduct();

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('PASS');
        expect(result.violations).toHaveLength(0);
        expect(result.checks.some(c => c.checkName === 'budget' && c.decision === 'PASS')).toBe(true);
        expect(result.checks.some(c => c.checkName === 'product_category' && c.decision === 'PASS')).toBe(true);
        expect(result.checks.some(c => c.checkName === 'brand' && c.decision === 'PASS')).toBe(true);
        expect(result.checks.some(c => c.checkName === 'condition' && c.decision === 'PASS')).toBe(true);
      });

      it('should PASS when total exactly equals budget', () => {
        const policy = createBasePolicy({ maxBudgetCents: 16998 }); // Exactly equals total
        const product = createBaseProduct({
          priceCents: 14999,
          shippingCents: 799,
          taxEstimateCents: 1200, // Total: 16998
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('PASS');
        const budgetCheck = result.checks.find(c => c.checkName === 'budget');
        expect(budgetCheck?.decision).toBe('PASS');
      });

      it('should PASS with any brand when no brand required', () => {
        const policy = createBasePolicy({
          requiredBrand: null, // No brand requirement
        });
        const product = createBaseProduct({ brand: 'Bose' });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('PASS');
        expect(result.checks.find(c => c.checkName === 'brand')?.decision).toBe('PASS');
      });

      it.each(['Sony', 'Bose', 'bose'])('should PASS an explicitly allowed brand: %s', (brand) => {
        const policy = createBasePolicy({ requiredBrand: null, allowedBrands: ['Sony', 'Bose'] });
        const result = evaluatePolicy({ policy, product: createBaseProduct({ brand }) });
        expect(result.decision).toBe('PASS');
        expect(result.checks.find(c => c.checkName === 'allowed_brands')?.decision).toBe('PASS');
      });

      it('should PASS with any condition when condition is "any"', () => {
        const policy = createBasePolicy({
          allowedCondition: 'any',
        });
        const product = createBaseProduct({ condition: 'refurbished' });

        const result = evaluatePolicy({ policy, product });

        expect(result.checks.find(c => c.checkName === 'condition')?.decision).toBe('PASS');
      });
    });

    describe('BLOCK scenarios', () => {
      it('should BLOCK when total exceeds budget', () => {
        const policy = createBasePolicy({ maxBudgetCents: 10000 }); // $100 budget
        const product = createBaseProduct({
          priceCents: 14999, // $149.99
          shippingCents: 799,
          taxEstimateCents: 1200, // Total: 16998 > 10000
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'budget')).toBe(true);
      });

      it('should BLOCK refurbished when new is required', () => {
        const policy = createBasePolicy({ allowedCondition: 'new' });
        const product = createBaseProduct({ condition: 'refurbished' });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'condition')).toBe(true);
      });

      it('should BLOCK unauthorized subscriptions', () => {
        const product = createBaseProduct({
          hasSubscription: true,
          subscriptionInfo: {
            monthlyPriceCents: 1999,
            description: 'Premium audio subscription',
          },
        });
        const policy = createBasePolicy({
          allowSubscriptions: false,
          approvedProducts: [{
            productId: product.id,
            approvalReason: 'Product exceptions do not permit subscriptions',
            approvedAt: new Date().toISOString(),
          }],
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'subscription')).toBe(true);
      });

      it('should block simulated subscription drift without changing the saved purchase', () => {
        const product = createBaseProduct();
        const snapshot = createPurchaseSnapshot(product);
        const simulated = simulateUnauthorizedSubscription(product, snapshot);

        const result = validateOrderForCapture({
          policy: createBasePolicy(),
          product: simulated.product,
          purchaseSnapshot: simulated.purchaseSnapshot,
          paypalOrder: createPayPalOrder(snapshot.totalCents, snapshot.currency, snapshot.productSku, product),
          policyVersion: 1,
          localOrderId: 'local-order-123',
          expectedPaypalOrderId: 'paypal-order-123',
        });

        expect(product.hasSubscription).toBe(false);
        expect(snapshot.hasSubscription).toBe(false);
        expect(simulated.product.hasSubscription).toBe(true);
        expect(simulated.purchaseSnapshot.hasSubscription).toBe(true);
        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some((violation) => violation.checkName === 'subscription')).toBe(true);
      });

      it('should BLOCK when brand is strict and mismatches', () => {
        const policy = createBasePolicy({
          requiredBrand: 'Sony',
          allowSubstitutions: false, // strict brand
        });
        const product = createBaseProduct({ brand: 'Bose' });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'brand')).toBe(true);
      });

      it.each(['Apple', 'Sony imitation'])('should BLOCK a brand outside the allowed list: %s', (brand) => {
        const policy = createBasePolicy({ requiredBrand: null, allowedBrands: ['Sony', 'Bose'] });
        const result = evaluatePolicy({ policy, product: createBaseProduct({ brand }) });
        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'allowed_brands')).toBe(true);
      });

      it('does not allow the list to override a separate required brand', () => {
        const policy = createBasePolicy({ requiredBrand: 'Sony', allowedBrands: ['Sony', 'Bose'] });
        const result = evaluatePolicy({ policy, product: createBaseProduct({ brand: 'Bose' }) });
        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'brand')).toBe(true);
      });

      it('requires buyer approval for an allowed-brand substitution when substitutions are enabled', () => {
        const policy = createBasePolicy({
          requiredBrand: null,
          allowedBrands: ['Sony', 'Bose'],
          allowSubstitutions: true,
        });
        const product = createBaseProduct({ brand: 'Apple' });
        expect(evaluatePolicy({ policy, product }).decision).toBe('REVIEW');
        const approvedPolicy = {
          ...policy,
          approvedProducts: [{ productId: product.id, approvalReason: 'Confirmed', approvedAt: new Date().toISOString() }],
        };
        expect(evaluatePolicy({ policy: approvedPolicy, product }).decision).toBe('PASS');
        expect(evaluatePolicy({ policy: approvedPolicy, product: { ...product, id: 'another' } }).decision).toBe('REVIEW');
      });

      it('enforces the allowed brand list during capture validation', () => {
        const policy = createBasePolicy({ requiredBrand: null, allowedBrands: ['Sony', 'Bose'] });
        const product = createBaseProduct({ brand: 'Apple' });
        const snapshot = createPurchaseSnapshot(product);
        const result = validateOrderForCapture({
          policy,
          product,
          purchaseSnapshot: snapshot,
          paypalOrder: createPayPalOrder(snapshot.totalCents, snapshot.currency, snapshot.productSku, product),
          policyVersion: 1,
          localOrderId: 'local-order-123',
          expectedPaypalOrderId: 'paypal-order-123',
        });
        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'allowed_brands')).toBe(true);
      });

      it('should BLOCK when delivery exceeds deadline', () => {
        const policy = createBasePolicy({
          deliveryDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days
        });
        const product = createBaseProduct({
          deliveryDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(), // 14 days
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'delivery_deadline')).toBe(true);
      });

      it('should BLOCK when policy is expired', () => {
        const policy = createBasePolicy({
          expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
        });
        const product = createBaseProduct();

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'policy_expiration')).toBe(true);
      });

      it('should REVIEW when merchant is not in allowed list', () => {
        const policy = createBasePolicy({
          allowedMerchants: ['Allowed Merchant 1', 'Allowed Merchant 2'],
        });
        const product = createBaseProduct({ merchantName: 'Unknown Store' });

        const result = evaluatePolicy({ policy, product });

        // Per policy engine: unknown merchant = REVIEW (not BLOCK)
        expect(result.decision).toBe('REVIEW');
        expect(result.warnings.some(v => v.checkName === 'merchant')).toBe(true);
      });

      it('should PASS after buyer approval of a reviewable merchant exception', () => {
        const product = createBaseProduct({ merchantName: 'Unknown Store' });
        const policy = createBasePolicy({
          allowedMerchants: ['Allowed Merchant 1'],
          approvedProducts: [{
            productId: product.id,
            approvalReason: 'Buyer confirmed this merchant exception',
            approvedAt: new Date().toISOString(),
          }],
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('PASS');
        expect(result.warnings).toHaveLength(0);
        expect(result.checks.find((check) => check.checkName === 'merchant')?.decision).toBe('PASS');
      });

      it('should BLOCK when merchant is in blocked list', () => {
        const policy = createBasePolicy({
          blockedMerchants: ['Bad Merchant'],
        });
        const product = createBaseProduct({ merchantName: 'Bad Merchant' });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'merchant')).toBe(true);
      });

      it('should not let product approval override a blocked merchant', () => {
        const product = createBaseProduct({ merchantName: 'Bad Merchant' });
        const policy = createBasePolicy({
          blockedMerchants: ['Bad Merchant'],
          approvedProducts: [{
            productId: product.id,
            approvalReason: 'Buyer confirmation must not override hard blocks',
            approvedAt: new Date().toISOString(),
          }],
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some((violation) => violation.checkName === 'merchant')).toBe(true);
      });

      it('should BLOCK when currency mismatches', () => {
        const policy = createBasePolicy({ currency: 'USD' });
        const product = createBaseProduct({ currency: 'EUR' });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('BLOCK');
        expect(result.violations.some(v => v.checkName === 'currency')).toBe(true);
      });
    });

    describe('REVIEW scenarios', () => {
      it('should REVIEW when brand substitution is allowed and brand differs', () => {
        const policy = createBasePolicy({
          requiredBrand: 'Sony',
          allowSubstitutions: true, // Substitutions allowed
        });
        const product = createBaseProduct({ brand: 'Bose' });

        const result = evaluatePolicy({ policy, product });

        // Should REVIEW (not block) for brand substitution
        expect(result.decision).toBe('REVIEW');
        expect(result.warnings.some(w => w.checkName === 'brand')).toBe(true);
      });

      it('should REVIEW when required attribute is missing', () => {
        const policy = createBasePolicy({
          requiredAttributes: [
            { attribute: 'noiseCancelling', value: 'yes', required: true },
            { attribute: 'portableCase', value: 'included', required: true },
          ],
        });
        const product = createBaseProduct({
          attributes: { noiseCancelling: 'yes' }, // Missing portableCase
        });

        const result = evaluatePolicy({ policy, product });

        expect(result.decision).toBe('REVIEW');
        // Attribute checks use format 'attribute_${attributeName}'
        expect(result.warnings.some(w => w.checkName === 'attribute_portableCase')).toBe(true);
      });

      it('should REVIEW when category partially matches', () => {
        const policy = createBasePolicy({ productCategory: 'headphones' });
        const product = createBaseProduct({ category: 'speakers' });

        const result = evaluatePolicy({ policy, product });

        // Category check results in REVIEW if not exact match per the engine
        expect(result.decision).toBe('REVIEW');
        expect(result.warnings.some(w => w.checkName === 'product_category')).toBe(true);
      });
    });

    describe('Edge cases', () => {
      it('should handle product with no attributes when none required', () => {
        const policy = createBasePolicy({ requiredAttributes: [] });
        const product = createBaseProduct({ attributes: {} });

        const result = evaluatePolicy({ policy, product });

        expect(['PASS', 'REVIEW']).toContain(result.decision);
      });

      it('should handle zero budget with free product', () => {
        const policy = createBasePolicy({ maxBudgetCents: 0 });
        const product = createBaseProduct({
          priceCents: 0,
          shippingCents: 0,
          taxEstimateCents: 0
        });

        const result = evaluatePolicy({ policy, product });

        // Should pass when total is 0 and budget is 0
        expect(result.decision).toBe('PASS');
      });

      it('should include timestamp in evaluation result', () => {
        const policy = createBasePolicy();
        const product = createBaseProduct();

        const result = evaluatePolicy({ policy, product });

        expect(result.evaluatedAt).toBeDefined();
        expect(new Date(result.evaluatedAt).getTime()).toBeLessThanOrEqual(Date.now());
      });
    });
  });

  describe('validateOrderForCapture', () => {
    it('should PASS when PayPal order matches snapshot', () => {
      const policy = createBasePolicy();
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const totalCents = snapshot.totalCents;
      const paypalOrder = createPayPalOrder(totalCents);

      const result = validateOrderForCapture({
        policy,
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('PASS');
      expect(result.violations).toHaveLength(0);
    });

    it('should BLOCK when PayPal amount exceeds snapshot', () => {
      const policy = createBasePolicy();
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents + 5000); // $50 more

      const result = validateOrderForCapture({
        policy,
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some(v =>
        v.checkName === 'amount_match' || v.explanation.toLowerCase().includes('amount')
      )).toBe(true);
    });

    it('should BLOCK when currency differs', () => {
      const policy = createBasePolicy();
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents, 'EUR'); // Different currency

      const result = validateOrderForCapture({
        policy,
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some(v =>
        v.checkName.includes('currency') || v.explanation.toLowerCase().includes('currency')
      )).toBe(true);
    });

    it('should BLOCK when policy has expired', () => {
      const policy = createBasePolicy({
        expiresAt: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(), // Yesterday
      });
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents);

      const result = validateOrderForCapture({
        policy,
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some(v => v.checkName === 'policy_expiration')).toBe(true);
    });

    it('should BLOCK when PayPal has no verifiable line item', () => {
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents);
      paypalOrder.purchase_units[0].items = [];

      const result = validateOrderForCapture({
        policy: createBasePolicy(),
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some((violation) => violation.checkName === 'items_match')).toBe(true);
    });

    it('should BLOCK when the purchase snapshot differs from the canonical product', () => {
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents);

      const result = validateOrderForCapture({
        policy: createBasePolicy(),
        product,
        purchaseSnapshot: { ...snapshot, productName: 'Tampered name' },
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some((violation) => violation.checkName === 'purchase_snapshot')).toBe(true);
    });

    it('should BLOCK when the PayPal order is associated with another local order', () => {
      const product = createBaseProduct();
      const snapshot = createPurchaseSnapshot(product);
      const paypalOrder = createPayPalOrder(snapshot.totalCents);
      paypalOrder.purchase_units[0].custom_id = 'different-local-order';

      const result = validateOrderForCapture({
        policy: createBasePolicy(),
        product,
        purchaseSnapshot: snapshot,
        paypalOrder,
        policyVersion: 1,
        localOrderId: 'local-order-123',
        expectedPaypalOrderId: 'paypal-order-123',
      });

      expect(result.decision).toBe('BLOCK');
      expect(result.violations.some((violation) => violation.checkName === 'order_identity')).toBe(true);
    });
  });
});
