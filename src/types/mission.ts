import { z } from 'zod';
import { PermissionPolicySchema, PolicyEvaluationSchema } from './policy';

// Mission status enum
export const MissionStatusSchema = z.enum([
  'draft',
  'pending_confirmation',
  'active',
  'completed',
  'cancelled',
  'expired',
]);

export type MissionStatus = z.infer<typeof MissionStatusSchema>;

// Mission schema for API responses
export const MissionSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  originalPrompt: z.string(),
  status: MissionStatusSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
  expiresAt: z.string().nullable(),
});

export type Mission = z.infer<typeof MissionSchema>;

// Mission with related data
export interface MissionWithPolicy extends Mission {
  currentPolicy: {
    id: string;
    version: number;
    policy: z.infer<typeof PermissionPolicySchema>;
    confirmedAt: string | null;
  } | null;
}

// Recommendation with product and evaluation
export interface RecommendationWithProduct {
  id: string;
  productId: string;
  aiRank: number;
  aiExplanation: string;
  policyDecision: 'PASS' | 'REVIEW' | 'BLOCK';
  evaluation: z.infer<typeof PolicyEvaluationSchema>;
  product: {
    id: string;
    sku: string;
    name: string;
    brand: string;
    description: string;
    category: string;
    color: string | null;
    condition: string;
    priceCents: number;
    shippingCents: number;
    taxEstimateCents: number;
    currency: string;
    deliveryDate: string;
    merchantName: string;
    imageUrl: string | null;
    hasSubscription: boolean;
  };
}

// Create mission request
export const CreateMissionRequestSchema = z.object({
  prompt: z.string().min(10, 'Please provide a more detailed shopping request'),
});

export type CreateMissionRequest = z.infer<typeof CreateMissionRequestSchema>;

// Confirm policy request
export const ConfirmPolicyRequestSchema = z.object({
  missionId: z.string(),
  policy: PermissionPolicySchema,
});

export type ConfirmPolicyRequest = z.infer<typeof ConfirmPolicyRequestSchema>;

// Evaluate products request
export const EvaluateProductsRequestSchema = z.object({
  missionId: z.string(),
});

export type EvaluateProductsRequest = z.infer<typeof EvaluateProductsRequestSchema>;
