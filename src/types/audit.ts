import { z } from 'zod';

// Audit event types
export const AuditEventTypeSchema = z.enum([
  'mission_created',
  'policy_generated',
  'policy_confirmed',
  'policy_updated',
  'products_recommended',
  'product_evaluated',
  'order_created',
  'order_approved',
  'order_capture_attempted',
  'order_captured',
  'order_blocked',
  'order_failed',
  'tampering_detected',
  'validation_failed',
]);

export type AuditEventType = z.infer<typeof AuditEventTypeSchema>;

// Audit event schema
export const AuditEventSchema = z.object({
  id: z.string(),
  missionId: z.string().nullable(),
  eventType: AuditEventTypeSchema,
  eventData: z.record(z.string(), z.unknown()),
  previousHash: z.string().nullable(),
  eventHash: z.string(),
  createdAt: z.string(),
});

export type AuditEvent = z.infer<typeof AuditEventSchema>;

// Audit chain verification result
export const AuditVerificationSchema = z.object({
  valid: z.boolean(),
  totalEvents: z.number().int(),
  verifiedEvents: z.number().int(),
  brokenAt: z.number().int().nullable(),
  details: z.string().optional(),
});

export type AuditVerification = z.infer<typeof AuditVerificationSchema>;

// Intent receipt (transaction summary)
export const IntentReceiptSchema = z.object({
  missionId: z.string(),
  originalPrompt: z.string(),
  confirmedPolicy: z.record(z.string(), z.unknown()),
  policyVersion: z.number().int(),
  product: z.object({
    id: z.string(),
    name: z.string(),
    brand: z.string(),
    sku: z.string(),
    priceCents: z.number().int(),
    shippingCents: z.number().int(),
    taxEstimateCents: z.number().int(),
    totalCents: z.number().int(),
    currency: z.string(),
  }),
  paypalOrderId: z.string(),
  paypalCaptureId: z.string(),
  transactionStatus: z.string(),
  buyerApprovedAt: z.string(),
  capturedAt: z.string(),
  aiRecommendationExplanation: z.string().nullable(),
  policyValidationResults: z.record(z.string(), z.unknown()),
  auditVerification: AuditVerificationSchema,
  auditTimeline: z.array(AuditEventSchema),
});

export type IntentReceipt = z.infer<typeof IntentReceiptSchema>;
