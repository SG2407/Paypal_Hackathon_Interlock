import { z } from 'zod';

// Product schema matching database model
export const ProductSchema = z.object({
  id: z.string(),
  sku: z.string(),
  name: z.string(),
  brand: z.string(),
  description: z.string(),
  category: z.string(),
  color: z.string().nullable(),
  condition: z.enum(['new', 'refurbished', 'used']),
  priceCents: z.number().int(),
  shippingCents: z.number().int(),
  taxEstimateCents: z.number().int(),
  currency: z.string(),
  deliveryDate: z.string(), // ISO date string
  merchantId: z.string(),
  merchantName: z.string(),
  imageUrl: z.string().nullable(),
  attributes: z.record(z.string(), z.string()).default({}),
  hasSubscription: z.boolean(),
  subscriptionInfo: z.object({
    monthlyPriceCents: z.number().int(),
    description: z.string(),
  }).nullable(),
});

export type Product = z.infer<typeof ProductSchema>;

// Product with calculated totals for display
export interface ProductWithTotals extends Product {
  totalCents: number;
  priceFormatted: string;
  shippingFormatted: string;
  taxFormatted: string;
  totalFormatted: string;
}

// Purchase snapshot stored with PayPal orders
export const PurchaseSnapshotSchema = z.object({
  productId: z.string(),
  productSku: z.string(),
  productName: z.string(),
  productBrand: z.string(),
  productCondition: z.string(),
  priceCents: z.number().int(),
  shippingCents: z.number().int(),
  taxEstimateCents: z.number().int(),
  totalCents: z.number().int(),
  currency: z.string(),
  deliveryDate: z.string(),
  merchantId: z.string(),
  merchantName: z.string(),
  quantity: z.number().int().default(1),
  hasSubscription: z.boolean(),
  subscriptionInfo: z.object({
    monthlyPriceCents: z.number().int(),
    description: z.string(),
  }).nullable(),
  snapshotCreatedAt: z.string(),
});

export type PurchaseSnapshot = z.infer<typeof PurchaseSnapshotSchema>;

// Format cents to currency string
export function formatCents(cents: number, currency: string = 'USD'): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

// Calculate product totals
export function calculateProductTotals(product: Product): ProductWithTotals {
  const totalCents = product.priceCents + product.shippingCents + product.taxEstimateCents;
  return {
    ...product,
    totalCents,
    priceFormatted: formatCents(product.priceCents, product.currency),
    shippingFormatted: formatCents(product.shippingCents, product.currency),
    taxFormatted: formatCents(product.taxEstimateCents, product.currency),
    totalFormatted: formatCents(totalCents, product.currency),
  };
}
