import { describe, it, expect } from 'vitest';
import { compileIntentMock, scoreProductMatch, recommendProductsMock } from './index';
import { PermissionPolicy } from '@/types/policy';
import { Product } from '@/types/product';

describe('AI Module', () => {
  describe('compileIntentMock', () => {
    it('should parse headphones with Sony brand and budget', () => {
      const result = compileIntentMock('I need Sony noise-cancelling headphones under $200');

      expect(result.success).toBe(true);
      expect(result.policy).not.toBeNull();
      expect(result.policy?.productCategory).toBe('headphones');
      expect(result.policy?.requiredBrand).toBe('Sony');
      expect(result.policy?.maxBudgetCents).toBe(20000);
      expect(result.policy?.requiredAttributes).toContainEqual({
        attribute: 'noiseCancelling',
        value: 'yes',
        required: true,
      });
    });

    it('should parse laptop request', () => {
      const result = compileIntentMock('Looking for a Dell laptop under $1,500');

      expect(result.success).toBe(true);
      expect(result.policy?.productCategory).toBe('laptop');
      expect(result.policy?.requiredBrand).toBe('Dell');
      expect(result.policy?.maxBudgetCents).toBe(150000);
    });

    it('should parse refurbished condition', () => {
      const result = compileIntentMock('I want a refurbished phone under $300');

      expect(result.success).toBe(true);
      expect(result.policy?.allowedCondition).toBe('refurbished');
    });

    it('should parse wireless attribute', () => {
      const result = compileIntentMock('Need wireless headphones under $100');

      expect(result.success).toBe(true);
      expect(result.policy?.requiredAttributes).toContainEqual({
        attribute: 'wireless',
        value: 'yes',
        required: true,
      });
    });

    it('should parse delivery deadline - next week', () => {
      const result = compileIntentMock('Need headphones by next week, budget $150');

      expect(result.success).toBe(true);
      expect(result.policy?.deliveryDeadline).not.toBeNull();

      const deadline = new Date(result.policy!.deliveryDeadline!);
      const now = new Date();
      const daysDiff = Math.ceil((deadline.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
      expect(daysDiff).toBeGreaterThanOrEqual(6);
      expect(daysDiff).toBeLessThanOrEqual(8);
    });

    it('should return clarification for vague requests', () => {
      // "Buy me anything" triggers vague detection
      const result = compileIntentMock('Buy me anything');

      expect(result.success).toBe(false);
      expect(result.policy).toBeNull();
      expect(result.clarificationQuestions.length).toBeGreaterThan(0);
    });

    it('should default to not allowing subscriptions', () => {
      const result = compileIntentMock('Get me Sony headphones under $200');

      expect(result.success).toBe(true);
      expect(result.policy?.allowSubscriptions).toBe(false);
    });

    it('should allow subscriptions when mentioned', () => {
      const result = compileIntentMock('Get me headphones with subscription option under $200');

      expect(result.success).toBe(true);
      expect(result.policy?.allowSubscriptions).toBe(true);
    });

    it('should default requireHumanApproval to true', () => {
      const result = compileIntentMock('Sony headphones under $300');

      expect(result.success).toBe(true);
      expect(result.policy?.requireHumanApproval).toBe(true);
    });

    it('should include raw interpretation', () => {
      const result = compileIntentMock('Sony headphones under $200');

      expect(result.rawInterpretation).not.toBeNull();
      expect(result.rawInterpretation).toContain('Sony');
    });
  });

  describe('scoreProductMatch', () => {
    function createTestPolicy(overrides: Partial<PermissionPolicy> = {}): PermissionPolicy {
      return {
        productCategory: 'headphones',
        requiredBrand: 'Sony',
        requiredAttributes: [
          { attribute: 'noiseCancelling', value: 'yes', required: true },
        ],
        allowedCondition: 'new',
        maxBudgetCents: 20000,
        currency: 'USD',
        budgetIncludesShipping: true,
        budgetIncludesTax: true,
        deliveryDeadline: null,
        minQuantity: 1,
        maxQuantity: 1,
        allowSubscriptions: false,
        allowAddOns: false,
        allowSubstitutions: false,
        allowedMerchants: null,
        blockedMerchants: [],
        requireHumanApproval: true,
        expiresAt: null,
        clarificationNeeded: [],
        approvedProducts: [],
        ...overrides,
      };
    }

    function createTestProduct(overrides: Partial<Product> = {}): Product {
      return {
        id: 'prod-1',
        sku: 'SKU-001',
        name: 'Sony WH-1000XM5',
        brand: 'Sony',
        description: 'Premium noise-cancelling headphones',
        category: 'headphones',
        color: 'black',
        condition: 'new',
        priceCents: 14999,
        shippingCents: 0,
        taxEstimateCents: 1200,
        currency: 'USD',
        deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
        merchantId: 'merchant-1',
        merchantName: 'Electronics Hub',
        imageUrl: null,
        attributes: {
          noiseCancelling: 'yes',
          wireless: 'yes',
        },
        hasSubscription: false,
        subscriptionInfo: null,
        ...overrides,
      };
    }

    it('should give high score for perfect match', () => {
      const policy = createTestPolicy();
      const product = createTestProduct();

      const { score } = scoreProductMatch(product, policy);
      expect(score).toBeGreaterThan(80);
    });

    it('should reduce score for brand mismatch', () => {
      const policy = createTestPolicy({ requiredBrand: 'Bose' });
      const product = createTestProduct({ brand: 'Sony' });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(80);
      expect(reasons.some(r => r.includes('Brand mismatch'))).toBe(true);
    });

    it('should reduce score for category mismatch', () => {
      const policy = createTestPolicy({ productCategory: 'laptop' });
      const product = createTestProduct({ category: 'headphones' });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(70); // Category mismatch reduces by 50, but budget bonus adds back
      expect(reasons.some(r => r.includes('Category mismatch'))).toBe(true);
    });

    it('should reduce score for over budget', () => {
      const policy = createTestPolicy({ maxBudgetCents: 10000 });
      const product = createTestProduct({
        priceCents: 14999,
        shippingCents: 500,
        taxEstimateCents: 1200,
      });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(80);
      expect(reasons.some(r => r.includes('Over budget'))).toBe(true);
    });

    it('should bonus for being within budget', () => {
      const policy = createTestPolicy({ maxBudgetCents: 30000 });
      const product = createTestProduct({
        priceCents: 14999,
        shippingCents: 0,
        taxEstimateCents: 1200,
      });

      const { reasons } = scoreProductMatch(product, policy);
      expect(reasons.some(r => r.includes('Within budget'))).toBe(true);
    });

    it('should reduce score for condition mismatch', () => {
      const policy = createTestPolicy({ allowedCondition: 'new' });
      const product = createTestProduct({ condition: 'refurbished' });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(100); // Condition mismatch reduces score
      expect(reasons.some(r => r.includes('Condition mismatch'))).toBe(true);
    });

    it('should not penalize condition if policy allows any', () => {
      const policy = createTestPolicy({ allowedCondition: 'any' });
      const product = createTestProduct({ condition: 'used' });

      const { reasons } = scoreProductMatch(product, policy);
      expect(reasons.some(r => r.includes('Condition mismatch'))).toBe(false);
    });

    it('should reduce score for missing required attribute', () => {
      const policy = createTestPolicy({
        requiredAttributes: [
          { attribute: 'batteryLife', value: '30 hours', required: true },
        ],
      });
      const product = createTestProduct({
        attributes: { noiseCancelling: 'yes' }, // Missing batteryLife
      });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(100); // Missing attribute reduces score
      expect(reasons.some(r => r.includes('Missing attribute'))).toBe(true);
    });

    it('should reduce score for late delivery', () => {
      const deadline = new Date();
      deadline.setDate(deadline.getDate() + 2); // 2 days from now

      const policy = createTestPolicy({
        deliveryDeadline: deadline.toISOString(),
      });

      const lateDelivery = new Date();
      lateDelivery.setDate(lateDelivery.getDate() + 10); // 10 days from now

      const product = createTestProduct({
        deliveryDate: lateDelivery.toISOString(),
      });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(90);
      expect(reasons.some(r => r.includes('days after deadline'))).toBe(true);
    });

    it('should reduce score for unwanted subscription', () => {
      const policy = createTestPolicy({ allowSubscriptions: false });
      const product = createTestProduct({ hasSubscription: true });

      const { score, reasons } = scoreProductMatch(product, policy);
      expect(score).toBeLessThan(100); // Subscription reduces score
      expect(reasons.some(r => r.includes('subscription'))).toBe(true);
    });

    it('should clamp score to 0-100 range', () => {
      // Create a terrible match
      const policy = createTestPolicy({
        productCategory: 'laptop',
        requiredBrand: 'Apple',
        maxBudgetCents: 1000,
      });
      const product = createTestProduct({
        category: 'headphones',
        brand: 'Sony',
        priceCents: 50000,
      });

      const { score } = scoreProductMatch(product, policy);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);
    });
  });

  describe('recommendProductsMock', () => {
    function createTestPolicy(): PermissionPolicy {
      return {
        productCategory: 'headphones',
        requiredBrand: 'Sony',
        requiredAttributes: [],
        allowedCondition: 'new',
        maxBudgetCents: 25000,
        currency: 'USD',
        budgetIncludesShipping: true,
        budgetIncludesTax: true,
        deliveryDeadline: null,
        minQuantity: 1,
        maxQuantity: 1,
        allowSubscriptions: false,
        allowAddOns: false,
        allowSubstitutions: false,
        allowedMerchants: null,
        blockedMerchants: [],
        requireHumanApproval: true,
        expiresAt: null,
        clarificationNeeded: [],
        approvedProducts: [],
      };
    }

    function createProducts(): Product[] {
      return [
        {
          id: 'prod-1',
          sku: 'SKU-001',
          name: 'Sony WH-1000XM5',
          brand: 'Sony',
          description: 'Premium noise-cancelling',
          category: 'headphones',
          color: 'black',
          condition: 'new',
          priceCents: 19999,
          shippingCents: 0,
          taxEstimateCents: 1600,
          currency: 'USD',
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          merchantId: 'm-1',
          merchantName: 'Store A',
          imageUrl: null,
          attributes: {},
          hasSubscription: false,
          subscriptionInfo: null,
        },
        {
          id: 'prod-2',
          sku: 'SKU-002',
          name: 'Bose QuietComfort',
          brand: 'Bose',
          description: 'Great headphones',
          category: 'headphones',
          color: 'white',
          condition: 'new',
          priceCents: 22999,
          shippingCents: 0,
          taxEstimateCents: 1800,
          currency: 'USD',
          deliveryDate: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
          merchantId: 'm-2',
          merchantName: 'Store B',
          imageUrl: null,
          attributes: {},
          hasSubscription: false,
          subscriptionInfo: null,
        },
        {
          id: 'prod-3',
          sku: 'SKU-003',
          name: 'Dell Laptop',
          brand: 'Dell',
          description: 'Laptop computer',
          category: 'laptop',
          color: 'silver',
          condition: 'new',
          priceCents: 99999,
          shippingCents: 0,
          taxEstimateCents: 8000,
          currency: 'USD',
          deliveryDate: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
          merchantId: 'm-3',
          merchantName: 'Store C',
          imageUrl: null,
          attributes: {},
          hasSubscription: false,
          subscriptionInfo: null,
        },
      ];
    }

    it('should rank Sony headphones first for Sony policy', () => {
      const policy = createTestPolicy();
      const products = createProducts();

      const result = recommendProductsMock({ policy, products });

      expect(result.recommendations.length).toBeGreaterThan(0);
      expect(result.recommendations[0].productId).toBe('prod-1');
      expect(result.recommendations[0].rank).toBe(1);
    });

    it('should exclude category mismatches with low scores', () => {
      const policy = createTestPolicy();
      const products = createProducts();

      const result = recommendProductsMock({ policy, products });

      // Laptop should not be recommended for headphones policy
      const hasLaptop = result.recommendations.some(r => r.productId === 'prod-3');
      expect(hasLaptop).toBe(false);
    });

    it('should respect maxRecommendations', () => {
      const policy = createTestPolicy();
      const products = createProducts();

      const result = recommendProductsMock({ policy, products, maxRecommendations: 1 });

      expect(result.recommendations.length).toBeLessThanOrEqual(1);
    });

    it('should provide reasoning', () => {
      const policy = createTestPolicy();
      const products = createProducts();

      const result = recommendProductsMock({ policy, products });

      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should handle empty product list', () => {
      const policy = createTestPolicy();

      const result = recommendProductsMock({ policy, products: [] });

      expect(result.recommendations).toHaveLength(0);
    });

    it('should include match scores', () => {
      const policy = createTestPolicy();
      const products = createProducts();

      const result = recommendProductsMock({ policy, products });

      for (const rec of result.recommendations) {
        expect(rec.matchScore).toBeGreaterThanOrEqual(0);
        expect(rec.matchScore).toBeLessThanOrEqual(100);
      }
    });
  });
});
