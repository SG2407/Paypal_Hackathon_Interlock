import { z } from 'zod';

// PayPal order status
export const PayPalOrderStatusSchema = z.enum([
  'created',
  'approved',
  'capturing',
  'captured',
  'failed',
  'blocked',
]);

export type PayPalOrderStatus = z.infer<typeof PayPalOrderStatusSchema>;

// PayPal order record from database
export const PayPalOrderRecordSchema = z.object({
  id: z.string(),
  missionId: z.string(),
  productId: z.string(),
  paypalOrderId: z.string(),
  amountCents: z.number().int(),
  captureAmountCents: z.number().int().nullable(),
  captureCurrency: z.string().nullable(),
  currency: z.string(),
  purchaseSnapshotJson: z.string(),
  policyVersion: z.number().int(),
  status: PayPalOrderStatusSchema,
  captureId: z.string().nullable(),
  captureStatus: z.string().nullable(),
  buyerApprovedAt: z.string().nullable(),
  capturedAt: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
});

export type PayPalOrderRecord = z.infer<typeof PayPalOrderRecordSchema>;

// Create order request
export const CreateOrderRequestSchema = z.object({
  missionId: z.string(),
  productId: z.string(),
});

export type CreateOrderRequest = z.infer<typeof CreateOrderRequestSchema>;

// Create order response
export const CreateOrderResponseSchema = z.object({
  success: z.boolean(),
  orderId: z.string().optional(),
  paypalOrderId: z.string().optional(),
  error: z.string().optional(),
  policyDecision: z.enum(['PASS', 'REVIEW', 'BLOCK']).optional(),
  violations: z.array(z.object({
    checkName: z.string(),
    explanation: z.string(),
  })).optional(),
});

export type CreateOrderResponse = z.infer<typeof CreateOrderResponseSchema>;

// Capture order request
export const CaptureOrderRequestSchema = z.object({
  orderId: z.string(),
});

export type CaptureOrderRequest = z.infer<typeof CaptureOrderRequestSchema>;

// Capture validation result
export const CaptureValidationSchema = z.object({
  valid: z.boolean(),
  reason: z.string().optional(),
  checks: z.array(z.object({
    name: z.string(),
    passed: z.boolean(),
    expected: z.string().nullable(),
    actual: z.string().nullable(),
    details: z.string().optional(),
  })),
});

export type CaptureValidation = z.infer<typeof CaptureValidationSchema>;

// Capture order response
export const CaptureOrderResponseSchema = z.object({
  success: z.boolean(),
  captureId: z.string().optional(),
  transactionStatus: z.string().optional(),
  error: z.string().optional(),
  validationResult: CaptureValidationSchema.optional(),
  blocked: z.boolean().optional(),
  blockReason: z.string().optional(),
});

export type CaptureOrderResponse = z.infer<typeof CaptureOrderResponseSchema>;

// PayPal API Order response (simplified)
export interface PayPalAPIOrder {
  id: string;
  status: string;
  intent: string;
  purchase_units: Array<{
    reference_id?: string;
    amount: {
      currency_code: string;
      value: string;
      breakdown?: {
        item_total?: { currency_code: string; value: string };
        shipping?: { currency_code: string; value: string };
        tax_total?: { currency_code: string; value: string };
      };
    };
    items?: Array<{
      name: string;
      quantity: string;
      unit_amount: { currency_code: string; value: string };
      sku?: string;
    }>;
    custom_id?: string;
    payments?: {
      captures?: PayPalAPICapture[];
    };
  }>;
  payer?: {
    email_address?: string;
    payer_id?: string;
  };
  create_time?: string;
  update_time?: string;
}

// PayPal API Capture response (simplified)
export interface PayPalAPICapture {
  id: string;
  status: string;
  amount: {
    currency_code: string;
    value: string;
  };
  final_capture: boolean;
  create_time: string;
  update_time: string;
}
