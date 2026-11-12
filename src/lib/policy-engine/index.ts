/**
 * IntentLock Deterministic Policy Engine
 *
 * This module implements the core authorization logic for purchase validation.
 * All decisions are made deterministically based on the confirmed policy and product data.
 * AI recommendations CANNOT override policy decisions.
 */

import {
  PermissionPolicy,
  PolicyDecision,
  PolicyCheck,
  PolicyEvaluation,
} from '@/types/policy';
import { Product, PurchaseSnapshot } from '@/types/product';
import { PayPalAPIOrder } from '@/types/paypal';

export interface PolicyEngineInput {
  policy: PermissionPolicy;
  product: Product;
  policyVersion?: number;
  currentTime?: Date;
  paypalOrder?: PayPalAPIOrder;
  purchaseSnapshot?: PurchaseSnapshot;
}

/**
 * Main policy evaluation function
 * Returns PASS, REVIEW, or BLOCK with detailed check results
 */
export function evaluatePolicy(input: PolicyEngineInput): PolicyEvaluation {
  const { policy, product, policyVersion = 1, currentTime = new Date() } = input;

  const checks: PolicyCheck[] = [];
  const violations: PolicyCheck[] = [];
  const warnings: PolicyCheck[] = [];

  // Check 1: Product category
  const categoryCheck = checkCategory(policy, product);
  checks.push(categoryCheck);
  if (categoryCheck.decision === 'BLOCK') violations.push(categoryCheck);
  else if (categoryCheck.decision === 'REVIEW') warnings.push(categoryCheck);

  // Check 2: Brand requirement
  const brandCheck = checkBrand(policy, product);
  checks.push(brandCheck);
  if (brandCheck.decision === 'BLOCK') violations.push(brandCheck);
  else if (brandCheck.decision === 'REVIEW') warnings.push(brandCheck);

  // Check 3: Product condition
  const conditionCheck = checkCondition(policy, product);
  checks.push(conditionCheck);
  if (conditionCheck.decision === 'BLOCK') violations.push(conditionCheck);
  else if (conditionCheck.decision === 'REVIEW') warnings.push(conditionCheck);

  // Check 4: Total budget
  const budgetCheck = checkBudget(policy, product);
  checks.push(budgetCheck);
  if (budgetCheck.decision === 'BLOCK') violations.push(budgetCheck);
  else if (budgetCheck.decision === 'REVIEW') warnings.push(budgetCheck);

  // Check 5: Currency
  const currencyCheck = checkCurrency(policy, product);
  checks.push(currencyCheck);
  if (currencyCheck.decision === 'BLOCK') violations.push(currencyCheck);
  else if (currencyCheck.decision === 'REVIEW') warnings.push(currencyCheck);

  // Check 6: Delivery deadline
  const deliveryCheck = checkDeliveryDeadline(policy, product);
  checks.push(deliveryCheck);
  if (deliveryCheck.decision === 'BLOCK') violations.push(deliveryCheck);
  else if (deliveryCheck.decision === 'REVIEW') warnings.push(deliveryCheck);

  // Check 7: Subscription
  const subscriptionCheck = checkSubscription(policy, product);
  checks.push(subscriptionCheck);
  if (subscriptionCheck.decision === 'BLOCK') violations.push(subscriptionCheck);
  else if (subscriptionCheck.decision === 'REVIEW') warnings.push(subscriptionCheck);

  // Check 8: Policy expiration
  const expirationCheck = checkPolicyExpiration(policy, currentTime);
  checks.push(expirationCheck);
  if (expirationCheck.decision === 'BLOCK') violations.push(expirationCheck);
  else if (expirationCheck.decision === 'REVIEW') warnings.push(expirationCheck);

  // Check 9: Merchant restrictions
  const merchantCheck = checkMerchant(policy, product);
  checks.push(merchantCheck);
  if (merchantCheck.decision === 'BLOCK') violations.push(merchantCheck);
  else if (merchantCheck.decision === 'REVIEW') warnings.push(merchantCheck);

  // Check 10: Required attributes
  const attributeChecks = checkRequiredAttributes(policy, product);
  checks.push(...attributeChecks);
  for (const check of attributeChecks) {
    if (check.decision === 'BLOCK') violations.push(check);
    else if (check.decision === 'REVIEW') warnings.push(check);
  }

  // Determine final decision
  let decision: PolicyDecision = 'PASS';
  if (violations.length > 0) {
    decision = 'BLOCK';
  } else if (warnings.length > 0) {
    decision = 'REVIEW';
  }

  return {
    decision,
    violations,
    warnings,
    checks,
    evaluatedAt: currentTime.toISOString(),
    policyVersion,
  };
}

/**
 * Validate PayPal order against purchase snapshot before capture
 */
export function validateOrderForCapture(input: {
  policy: PermissionPolicy;
  product: Product;
  purchaseSnapshot: PurchaseSnapshot;
  paypalOrder: PayPalAPIOrder;
  policyVersion: number;
  localOrderId: string;
  expectedPaypalOrderId: string;
  allowCompletedOrder?: boolean;
  currentTime?: Date;
}): PolicyEvaluation {
  const {
    policy,
    product,
    purchaseSnapshot,
    paypalOrder,
    policyVersion,
    localOrderId,
    expectedPaypalOrderId,
    allowCompletedOrder = false,
    currentTime = new Date(),
  } = input;

  // First run standard policy evaluation
  const baseEvaluation = evaluatePolicy({ policy, product, policyVersion, currentTime });

  const checks = [...baseEvaluation.checks];
  const violations = [...baseEvaluation.violations];
  const warnings = [...baseEvaluation.warnings];

  // Additional capture-time checks
  const identityCheck = checkOrderIdentity(paypalOrder, localOrderId, expectedPaypalOrderId);
  checks.push(identityCheck);
  if (identityCheck.decision === 'BLOCK') violations.push(identityCheck);

  const snapshotCheck = checkSnapshotMatchesProduct(purchaseSnapshot, product);
  checks.push(snapshotCheck);
  if (snapshotCheck.decision === 'BLOCK') violations.push(snapshotCheck);

  // Check: PayPal order status is APPROVED
  const statusCheck = checkPayPalOrderStatus(paypalOrder, allowCompletedOrder);
  checks.push(statusCheck);
  if (statusCheck.decision === 'BLOCK') violations.push(statusCheck);

  // Check: Amount matches snapshot
  const amountCheck = checkAmountMatch(purchaseSnapshot, paypalOrder);
  checks.push(amountCheck);
  if (amountCheck.decision === 'BLOCK') violations.push(amountCheck);

  // Check: Currency matches
  const currencyMatchCheck = checkCurrencyMatch(purchaseSnapshot, paypalOrder);
  checks.push(currencyMatchCheck);
  if (currencyMatchCheck.decision === 'BLOCK') violations.push(currencyMatchCheck);

  const breakdownCheck = checkAmountBreakdown(purchaseSnapshot, paypalOrder);
  checks.push(breakdownCheck);
  if (breakdownCheck.decision === 'BLOCK') violations.push(breakdownCheck);

  // Check: Items match snapshot
  const itemsCheck = checkItemsMatch(purchaseSnapshot, paypalOrder);
  checks.push(itemsCheck);
  if (itemsCheck.decision === 'BLOCK') violations.push(itemsCheck);

  // Determine final decision
  let decision: PolicyDecision = 'PASS';
  if (violations.length > 0) {
    decision = 'BLOCK';
  } else if (warnings.length > 0) {
    decision = 'REVIEW';
  }

  return {
    decision,
    violations,
    warnings,
    checks,
    evaluatedAt: currentTime.toISOString(),
    policyVersion,
  };
}

// Individual check functions

function checkCategory(policy: PermissionPolicy, product: Product): PolicyCheck {
  const expected = policy.productCategory.toLowerCase();
  const actual = product.category.toLowerCase();

  if (actual.includes(expected) || expected.includes(actual)) {
    return {
      checkName: 'product_category',
      expected: policy.productCategory,
      actual: product.category,
      decision: 'PASS',
      explanation: `Product category "${product.category}" matches required category "${policy.productCategory}"`,
    };
  }

  if (hasBuyerApprovedProduct(policy, product.id)) {
    return {
      checkName: 'product_category',
      expected: policy.productCategory,
      actual: product.category,
      decision: 'PASS',
      explanation: `Buyer explicitly approved this product-category exception for ${product.name}`,
    };
  }

  return {
    checkName: 'product_category',
    expected: policy.productCategory,
    actual: product.category,
    decision: 'REVIEW',
    explanation: `Product category "${product.category}" may not match required category "${policy.productCategory}"`,
  };
}

function checkBrand(policy: PermissionPolicy, product: Product): PolicyCheck {
  if (!policy.requiredBrand) {
    return {
      checkName: 'brand',
      expected: 'Any brand',
      actual: product.brand,
      decision: 'PASS',
      explanation: 'No specific brand required',
    };
  }

  const expected = policy.requiredBrand.toLowerCase();
  const actual = product.brand.toLowerCase();

  if (actual === expected || actual.includes(expected)) {
    return {
      checkName: 'brand',
      expected: policy.requiredBrand,
      actual: product.brand,
      decision: 'PASS',
      explanation: `Product brand "${product.brand}" matches required brand "${policy.requiredBrand}"`,
    };
  }

  if (policy.allowSubstitutions && hasBuyerApprovedProduct(policy, product.id)) {
    return {
      checkName: 'brand',
      expected: policy.requiredBrand,
      actual: product.brand,
      decision: 'PASS',
      explanation: `Buyer explicitly approved this brand substitution for ${product.name}`,
    };
  }

  // If substitutions are not allowed, this is a BLOCK
  if (!policy.allowSubstitutions) {
    return {
      checkName: 'brand',
      expected: policy.requiredBrand,
      actual: product.brand,
      decision: 'BLOCK',
      explanation: `Product brand "${product.brand}" does not match required brand "${policy.requiredBrand}" and substitutions are not allowed`,
    };
  }

  return {
    checkName: 'brand',
    expected: policy.requiredBrand,
    actual: product.brand,
    decision: 'REVIEW',
    explanation: `Product brand "${product.brand}" differs from required "${policy.requiredBrand}" - requires buyer approval`,
  };
}

function checkCondition(policy: PermissionPolicy, product: Product): PolicyCheck {
  const allowed = policy.allowedCondition;
  const actual = product.condition;

  if (allowed === 'any') {
    return {
      checkName: 'condition',
      expected: 'any',
      actual,
      decision: 'PASS',
      explanation: 'Any product condition is allowed',
    };
  }

  if (actual === allowed) {
    return {
      checkName: 'condition',
      expected: allowed,
      actual,
      decision: 'PASS',
      explanation: `Product condition "${actual}" matches required condition "${allowed}"`,
    };
  }

  // "new" is stricter than "refurbished" which is stricter than "used"
  if (allowed === 'new' && actual !== 'new') {
    return {
      checkName: 'condition',
      expected: allowed,
      actual,
      decision: 'BLOCK',
      explanation: `Product is "${actual}" but buyer requires "new" condition - BLOCKED`,
    };
  }

  if (allowed === 'refurbished' && actual === 'used') {
    return {
      checkName: 'condition',
      expected: allowed,
      actual,
      decision: 'BLOCK',
      explanation: `Product is "used" but buyer requires at least "refurbished" condition - BLOCKED`,
    };
  }

  return {
    checkName: 'condition',
    expected: allowed,
    actual,
    decision: 'PASS',
    explanation: `Product condition "${actual}" is acceptable (required: ${allowed} or better)`,
  };
}

function checkBudget(policy: PermissionPolicy, product: Product): PolicyCheck {
  let totalCents = product.priceCents;

  if (policy.budgetIncludesShipping) {
    totalCents += product.shippingCents;
  }

  if (policy.budgetIncludesTax) {
    totalCents += product.taxEstimateCents;
  }

  const maxBudget = policy.maxBudgetCents;
  const expectedFormatted = `$${(maxBudget / 100).toFixed(2)}`;
  const actualFormatted = `$${(totalCents / 100).toFixed(2)}`;

  if (totalCents <= maxBudget) {
    return {
      checkName: 'budget',
      expected: expectedFormatted,
      actual: actualFormatted,
      decision: 'PASS',
      explanation: `Total ${actualFormatted} is within budget of ${expectedFormatted}`,
    };
  }

  return {
    checkName: 'budget',
    expected: expectedFormatted,
    actual: actualFormatted,
    decision: 'BLOCK',
    explanation: `Total ${actualFormatted} exceeds maximum budget of ${expectedFormatted} - BLOCKED`,
  };
}

function checkCurrency(policy: PermissionPolicy, product: Product): PolicyCheck {
  if (product.currency === policy.currency) {
    return {
      checkName: 'currency',
      expected: policy.currency,
      actual: product.currency,
      decision: 'PASS',
      explanation: `Currency ${product.currency} matches required currency`,
    };
  }

  return {
    checkName: 'currency',
    expected: policy.currency,
    actual: product.currency,
    decision: 'BLOCK',
    explanation: `Product currency ${product.currency} does not match required ${policy.currency} - BLOCKED`,
  };
}

function checkDeliveryDeadline(
  policy: PermissionPolicy,
  product: Product
): PolicyCheck {
  if (!policy.deliveryDeadline) {
    return {
      checkName: 'delivery_deadline',
      expected: 'No deadline',
      actual: product.deliveryDate,
      decision: 'PASS',
      explanation: 'No delivery deadline specified',
    };
  }

  const deadline = new Date(policy.deliveryDeadline);
  const deliveryDate = new Date(product.deliveryDate);

  if (deliveryDate <= deadline) {
    return {
      checkName: 'delivery_deadline',
      expected: policy.deliveryDeadline,
      actual: product.deliveryDate,
      decision: 'PASS',
      explanation: `Estimated delivery ${product.deliveryDate} is before deadline ${policy.deliveryDeadline}`,
    };
  }

  return {
    checkName: 'delivery_deadline',
    expected: policy.deliveryDeadline,
    actual: product.deliveryDate,
    decision: 'BLOCK',
    explanation: `Estimated delivery ${product.deliveryDate} is after required deadline ${policy.deliveryDeadline} - BLOCKED`,
  };
}

function checkSubscription(policy: PermissionPolicy, product: Product): PolicyCheck {
  if (!product.hasSubscription) {
    return {
      checkName: 'subscription',
      expected: 'No subscription',
      actual: 'No subscription',
      decision: 'PASS',
      explanation: 'Product does not include any subscription',
    };
  }

  if (policy.allowSubscriptions) {
    return {
      checkName: 'subscription',
      expected: 'Subscriptions allowed',
      actual: 'Has subscription',
      decision: 'PASS',
      explanation: 'Product has subscription and subscriptions are allowed',
    };
  }

  const subInfo = product.subscriptionInfo;
  const subDesc = subInfo ? `${subInfo.description} ($${(subInfo.monthlyPriceCents / 100).toFixed(2)}/mo)` : 'Unknown subscription';

  return {
    checkName: 'subscription',
    expected: 'No subscription',
    actual: subDesc,
    decision: 'BLOCK',
    explanation: `Product includes unauthorized subscription: ${subDesc} - BLOCKED`,
  };
}

function checkPolicyExpiration(policy: PermissionPolicy, currentTime: Date): PolicyCheck {
  if (!policy.expiresAt) {
    return {
      checkName: 'policy_expiration',
      expected: 'No expiration',
      actual: 'Active',
      decision: 'PASS',
      explanation: 'Policy has no expiration date',
    };
  }

  const expiresAt = new Date(policy.expiresAt);

  if (currentTime < expiresAt) {
    return {
      checkName: 'policy_expiration',
      expected: policy.expiresAt,
      actual: currentTime.toISOString(),
      decision: 'PASS',
      explanation: `Policy is valid until ${policy.expiresAt}`,
    };
  }

  return {
    checkName: 'policy_expiration',
    expected: policy.expiresAt,
    actual: currentTime.toISOString(),
    decision: 'BLOCK',
    explanation: `Policy expired at ${policy.expiresAt} - BLOCKED`,
  };
}

function checkMerchant(policy: PermissionPolicy, product: Product): PolicyCheck {
  // Check blocked merchants first
  if (policy.blockedMerchants.length > 0) {
    const isBlocked = policy.blockedMerchants.some(
      m => m.toLowerCase() === product.merchantName.toLowerCase()
    );
    if (isBlocked) {
      return {
        checkName: 'merchant',
        expected: `Not in blocked list: ${policy.blockedMerchants.join(', ')}`,
        actual: product.merchantName,
        decision: 'BLOCK',
        explanation: `Merchant "${product.merchantName}" is in the blocked list - BLOCKED`,
      };
    }
  }

  // Check allowed merchants
  if (policy.allowedMerchants && policy.allowedMerchants.length > 0) {
    const isAllowed = policy.allowedMerchants.some(
      m => m.toLowerCase() === product.merchantName.toLowerCase()
    );
    if (!isAllowed) {
      if (hasBuyerApprovedProduct(policy, product.id)) {
        return {
          checkName: 'merchant',
          expected: `One of: ${policy.allowedMerchants.join(', ')}`,
          actual: product.merchantName,
          decision: 'PASS',
          explanation: `Buyer explicitly approved this merchant exception for ${product.name}`,
        };
      }
      return {
        checkName: 'merchant',
        expected: `One of: ${policy.allowedMerchants.join(', ')}`,
        actual: product.merchantName,
        decision: 'REVIEW',
        explanation: `Merchant "${product.merchantName}" is not in the allowed list - requires buyer approval`,
      };
    }
  }

  return {
    checkName: 'merchant',
    expected: 'Acceptable merchant',
    actual: product.merchantName,
    decision: 'PASS',
    explanation: `Merchant "${product.merchantName}" is acceptable`,
  };
}

function hasBuyerApprovedProduct(policy: PermissionPolicy, productId: string): boolean {
  return policy.approvedProducts.some((approval) => approval.productId === productId);
}

function checkRequiredAttributes(policy: PermissionPolicy, product: Product): PolicyCheck[] {
  if (!policy.requiredAttributes || policy.requiredAttributes.length === 0) {
    return [];
  }

  const checks: PolicyCheck[] = [];
  const productAttrs = product.attributes || {};
  const buyerApproved = hasBuyerApprovedProduct(policy, product.id);

  for (const req of policy.requiredAttributes) {
    const actualValue = productAttrs[req.attribute] || product[req.attribute as keyof Product] || null;

    if (!actualValue) {
      checks.push({
        checkName: `attribute_${req.attribute}`,
        expected: req.value,
        actual: null,
        decision: req.required && !buyerApproved ? 'REVIEW' : 'PASS',
        explanation: req.required && !buyerApproved
          ? `Required attribute "${req.attribute}" not found on product - requires verification`
          : buyerApproved
            ? `Buyer explicitly accepted that "${req.attribute}" could not be verified for this product`
            : `Optional attribute "${req.attribute}" not found`,
      });
      continue;
    }

    const matches = String(actualValue).toLowerCase().includes(req.value.toLowerCase());

    if (matches) {
      checks.push({
        checkName: `attribute_${req.attribute}`,
        expected: req.value,
        actual: String(actualValue),
        decision: 'PASS',
        explanation: `Attribute "${req.attribute}" matches: ${actualValue}`,
      });
    } else if (req.required) {
      checks.push({
        checkName: `attribute_${req.attribute}`,
        expected: req.value,
        actual: String(actualValue),
        decision: 'BLOCK',
        explanation: `Required attribute "${req.attribute}" is "${actualValue}" but expected "${req.value}" - BLOCKED`,
      });
    } else {
      checks.push({
        checkName: `attribute_${req.attribute}`,
        expected: req.value,
        actual: String(actualValue),
        decision: buyerApproved ? 'PASS' : 'REVIEW',
        explanation: buyerApproved
          ? `Buyer explicitly approved the "${req.attribute}" exception for this product`
          : `Attribute "${req.attribute}" is "${actualValue}" instead of "${req.value}" - may need approval`,
      });
    }
  }

  return checks;
}

// PayPal-specific validation checks

function checkPayPalOrderStatus(paypalOrder: PayPalAPIOrder, allowCompletedOrder: boolean): PolicyCheck {
  if (paypalOrder.status === 'APPROVED' || (allowCompletedOrder && paypalOrder.status === 'COMPLETED')) {
    return {
      checkName: 'paypal_order_status',
      expected: allowCompletedOrder ? 'APPROVED or previously captured COMPLETED' : 'APPROVED',
      actual: paypalOrder.status,
      decision: 'PASS',
      explanation: paypalOrder.status === 'APPROVED'
        ? 'PayPal order has been approved by the buyer'
        : 'Previously captured PayPal order is being recovered after an interrupted response',
    };
  }

  return {
    checkName: 'paypal_order_status',
    expected: 'APPROVED',
    actual: paypalOrder.status,
    decision: 'BLOCK',
    explanation: `PayPal order status is "${paypalOrder.status}" but expected "APPROVED" - BLOCKED`,
  };
}

function checkOrderIdentity(
  paypalOrder: PayPalAPIOrder,
  localOrderId: string,
  expectedPaypalOrderId: string,
): PolicyCheck {
  const unit = paypalOrder.purchase_units?.length === 1 ? paypalOrder.purchase_units[0] : null;
  const matches = paypalOrder.id === expectedPaypalOrderId
    && paypalOrder.intent === 'CAPTURE'
    && unit?.custom_id === localOrderId;
  return {
    checkName: 'order_identity',
    expected: `PayPal order ${expectedPaypalOrderId} linked to local order ${localOrderId}`,
    actual: `PayPal order ${paypalOrder.id}; intent ${paypalOrder.intent}; custom_id ${unit?.custom_id ?? 'missing'}; purchase units ${paypalOrder.purchase_units?.length ?? 0}`,
    decision: matches ? 'PASS' : 'BLOCK',
    explanation: matches
      ? 'PayPal order ID and local order association match'
      : 'PayPal order ID or local order association does not match; capture blocked',
  };
}

function checkSnapshotMatchesProduct(snapshot: PurchaseSnapshot, product: Product): PolicyCheck {
  const expectedTotal = product.priceCents + product.shippingCents + product.taxEstimateCents;
  const matches = snapshot.productId === product.id
    && snapshot.productSku === product.sku
    && snapshot.productName === product.name
    && snapshot.productBrand === product.brand
    && snapshot.productCondition === product.condition
    && snapshot.priceCents === product.priceCents
    && snapshot.shippingCents === product.shippingCents
    && snapshot.taxEstimateCents === product.taxEstimateCents
    && snapshot.totalCents === expectedTotal
    && snapshot.currency === product.currency
    && snapshot.deliveryDate === product.deliveryDate
    && snapshot.merchantId === product.merchantId
    && snapshot.merchantName === product.merchantName
    && snapshot.quantity === 1
    && snapshot.hasSubscription === product.hasSubscription
    && JSON.stringify(snapshot.subscriptionInfo) === JSON.stringify(product.subscriptionInfo);
  return {
    checkName: 'purchase_snapshot',
    expected: `Stored snapshot matching product ${product.sku} and catalog values`,
    actual: `Snapshot product ${snapshot.productSku}; quantity ${snapshot.quantity}; total ${snapshot.totalCents}`,
    decision: matches ? 'PASS' : 'BLOCK',
    explanation: matches
      ? 'Stored purchase snapshot matches the current canonical product record'
      : 'Stored purchase snapshot differs from the canonical product record; capture blocked',
  };
}

function amountToCents(value: string | undefined): number | null {
  if (!value || !/^\d+(?:\.\d{1,2})?$/.test(value)) return null;
  const cents = Math.round(Number(value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function checkAmountMatch(snapshot: PurchaseSnapshot, paypalOrder: PayPalAPIOrder): PolicyCheck {
  const expectedCents = snapshot.totalCents;
  const expectedFormatted = (expectedCents / 100).toFixed(2);

  const purchaseUnit = paypalOrder.purchase_units?.length === 1 ? paypalOrder.purchase_units[0] : null;
  const actualValue = purchaseUnit?.amount?.value || 'MISSING';
  const actualCents = amountToCents(purchaseUnit?.amount?.value);

  if (actualCents === expectedCents) {
    return {
      checkName: 'amount_match',
      expected: expectedFormatted,
      actual: actualValue,
      decision: 'PASS',
      explanation: `PayPal order amount $${actualValue} matches expected $${expectedFormatted}`,
    };
  }

  return {
    checkName: 'amount_match',
    expected: expectedFormatted,
    actual: actualValue,
    decision: 'BLOCK',
    explanation: `PayPal order amount $${actualValue} does not match expected $${expectedFormatted} - BLOCKED (possible tampering)`,
  };
}

function checkCurrencyMatch(snapshot: PurchaseSnapshot, paypalOrder: PayPalAPIOrder): PolicyCheck {
  const expected = snapshot.currency;
  const purchaseUnit = paypalOrder.purchase_units?.length === 1 ? paypalOrder.purchase_units[0] : null;
  const actual = purchaseUnit?.amount?.currency_code || 'UNKNOWN';

  if (actual === expected) {
    return {
      checkName: 'currency_match',
      expected,
      actual,
      decision: 'PASS',
      explanation: `PayPal order currency ${actual} matches expected ${expected}`,
    };
  }

  return {
    checkName: 'currency_match',
    expected,
    actual,
    decision: 'BLOCK',
    explanation: `PayPal order currency ${actual} does not match expected ${expected} - BLOCKED`,
  };
}

function checkAmountBreakdown(snapshot: PurchaseSnapshot, paypalOrder: PayPalAPIOrder): PolicyCheck {
  const amount = paypalOrder.purchase_units?.length === 1 ? paypalOrder.purchase_units[0].amount : null;
  const breakdown = amount?.breakdown;
  const itemTotal = amountToCents(breakdown?.item_total?.value);
  const shipping = amountToCents(breakdown?.shipping?.value);
  const tax = amountToCents(breakdown?.tax_total?.value);
  const matches = itemTotal === snapshot.priceCents
    && shipping === snapshot.shippingCents
    && tax === snapshot.taxEstimateCents
    && breakdown?.item_total?.currency_code === snapshot.currency
    && breakdown?.shipping?.currency_code === snapshot.currency
    && breakdown?.tax_total?.currency_code === snapshot.currency;
  return {
    checkName: 'amount_breakdown',
    expected: `item ${snapshot.priceCents}, shipping ${snapshot.shippingCents}, tax ${snapshot.taxEstimateCents} ${snapshot.currency}`,
    actual: breakdown
      ? `item ${breakdown.item_total?.value ?? 'missing'}, shipping ${breakdown.shipping?.value ?? 'missing'}, tax ${breakdown.tax_total?.value ?? 'missing'}`
      : 'missing amount breakdown',
    decision: matches ? 'PASS' : 'BLOCK',
    explanation: matches
      ? 'PayPal item, shipping, and tax breakdown matches the saved purchase snapshot'
      : 'PayPal amount breakdown differs from the saved purchase snapshot; capture blocked',
  };
}

function checkItemsMatch(snapshot: PurchaseSnapshot, paypalOrder: PayPalAPIOrder): PolicyCheck {
  const purchaseUnit = paypalOrder.purchase_units?.length === 1 ? paypalOrder.purchase_units[0] : null;
  const items = purchaseUnit?.items || [];
  const item = items.length === 1 ? items[0] : null;
  const unitAmount = amountToCents(item?.unit_amount?.value);
  const matches = item?.sku === snapshot.productSku
    && item.quantity === String(snapshot.quantity)
    && unitAmount === snapshot.priceCents
    && item.unit_amount.currency_code === snapshot.currency;
  return {
    checkName: 'items_match',
    expected: `${snapshot.quantity} × ${snapshot.productSku} at ${snapshot.priceCents} cents`,
    actual: item
      ? `${item.quantity} × ${item.sku ?? 'missing SKU'} at ${item.unit_amount.value} ${item.unit_amount.currency_code}`
      : `${items.length} line items`,
    decision: matches ? 'PASS' : 'BLOCK',
    explanation: matches
      ? `PayPal line item matches product SKU ${snapshot.productSku}`
      : 'PayPal line items do not exactly match the product, quantity, or unit amount; capture blocked',
  };
}

export default evaluatePolicy;
