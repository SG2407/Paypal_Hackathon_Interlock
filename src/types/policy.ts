import { z } from 'zod';

// Policy decision types
export type PolicyDecision = 'PASS' | 'REVIEW' | 'BLOCK';

// Product condition types
export const ProductConditionSchema = z.enum(['new', 'refurbished', 'used', 'any']);
export type ProductCondition = z.infer<typeof ProductConditionSchema>;

// Structured permission policy schema
export const PermissionPolicySchema = z.object({
  // Product requirements
  productCategory: z.string().describe('Product category (e.g., "headphones", "electronics")'),
  requiredBrand: z.string().nullable().describe('Required brand, null if no specific brand required'),
  allowedBrands: z.array(z.string().trim().min(1)).min(1).optional()
    .describe('Explicitly allowed alternative brands; omit when no brand list is specified'),
  requiredAttributes: z.array(z.object({
    attribute: z.string(),
    value: z.string(),
    required: z.boolean().default(true),
  })).default([]).describe('Specific product attributes required'),
  allowedCondition: ProductConditionSchema.describe('Allowed product condition'),

  // Budget constraints
  maxBudgetCents: z.number().int().positive().describe('Maximum total budget in cents'),
  currency: z.string().default('USD').describe('Currency code'),
  budgetIncludesShipping: z.boolean().default(true).describe('Whether shipping is included in budget'),
  budgetIncludesTax: z.boolean().default(true).describe('Whether tax is included in budget'),

  // Delivery requirements
  deliveryDeadline: z.string().nullable().describe('ISO date string for latest acceptable delivery'),

  // Quantity limits
  minQuantity: z.number().int().positive().default(1),
  maxQuantity: z.number().int().positive().default(1),

  // Subscription and add-on permissions
  allowSubscriptions: z.boolean().default(false).describe('Whether subscriptions are allowed'),
  allowAddOns: z.boolean().default(false).describe('Whether add-ons are allowed'),

  // Substitution permissions
  allowSubstitutions: z.boolean().default(false).describe('Whether alternative products are allowed'),

  // Merchant restrictions
  allowedMerchants: z.array(z.string()).nullable().describe('Specific allowed merchants, null if any'),
  blockedMerchants: z.array(z.string()).default([]).describe('Specifically blocked merchants'),

  // Human approval
  requireHumanApproval: z.boolean().default(true).describe('Whether buyer must approve payment'),
  approvedProducts: z.array(z.object({
    productId: z.string(),
    approvalReason: z.string(),
    approvedAt: z.string(),
  })).default([]).describe('Product-specific exceptions explicitly confirmed by the buyer'),

  // Policy metadata
  expiresAt: z.string().nullable().describe('ISO date string for policy expiration'),
  clarificationNeeded: z.array(z.string()).default([]).describe('Questions that need buyer clarification'),
});

export type PermissionPolicy = z.infer<typeof PermissionPolicySchema>;

// Policy check result for individual validations
export const PolicyCheckSchema = z.object({
  checkName: z.string(),
  expected: z.string().nullable(),
  actual: z.string().nullable(),
  decision: z.enum(['PASS', 'REVIEW', 'BLOCK']),
  explanation: z.string(),
});

export type PolicyCheck = z.infer<typeof PolicyCheckSchema>;

// Full policy evaluation result
export const PolicyEvaluationSchema = z.object({
  decision: z.enum(['PASS', 'REVIEW', 'BLOCK']),
  violations: z.array(PolicyCheckSchema),
  warnings: z.array(PolicyCheckSchema),
  checks: z.array(PolicyCheckSchema),
  evaluatedAt: z.string(),
  policyVersion: z.number(),
});

export type PolicyEvaluation = z.infer<typeof PolicyEvaluationSchema>;

export const PurchasePolicySchema = PermissionPolicySchema;
export type PurchasePolicy = PermissionPolicy;

export type ValidationResult = PolicyEvaluation;

// AI Intent Compilation response
export const IntentCompilationResponseSchema = z.object({
  success: z.boolean(),
  policy: PermissionPolicySchema.nullable(),
  clarificationQuestions: z.array(z.string()).default([]),
  rawInterpretation: z.string().nullable(),
});

export type IntentCompilationResponse = z.infer<typeof IntentCompilationResponseSchema>;

// Product recommendation from AI
export const ProductRecommendationSchema = z.object({
  productId: z.string(),
  rank: z.number().int().positive(),
  explanation: z.string(),
  matchScore: z.number().min(0).max(100),
});

export type ProductRecommendation = z.infer<typeof ProductRecommendationSchema>;

// AI Recommendation response
export const AIRecommendationResponseSchema = z.object({
  recommendations: z.array(ProductRecommendationSchema),
  reasoning: z.string(),
});

export type AIRecommendationResponse = z.infer<typeof AIRecommendationResponseSchema>;
