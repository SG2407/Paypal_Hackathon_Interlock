import type { Product as DatabaseProduct } from '@prisma/client';
import { ProductSchema, type Product, PurchaseSnapshotSchema, type PurchaseSnapshot } from '@/types/product';

export function productFromRecord(record: DatabaseProduct): Product {
  return ProductSchema.parse({
    id: record.id,
    sku: record.sku,
    name: record.name,
    brand: record.brand,
    description: record.description,
    category: record.category,
    color: record.color,
    condition: record.condition,
    priceCents: record.priceCents,
    shippingCents: record.shippingCents,
    taxEstimateCents: record.taxEstimateCents,
    currency: record.currency,
    deliveryDate: record.deliveryDate.toISOString(),
    merchantId: record.merchantId,
    merchantName: record.merchantName,
    imageUrl: record.imageUrl,
    attributes: JSON.parse(record.attributesJson),
    hasSubscription: record.hasSubscription,
    subscriptionInfo: record.subscriptionInfo ? JSON.parse(record.subscriptionInfo) : null,
  });
}

export function createPurchaseSnapshot(product: Product, quantity = 1): PurchaseSnapshot {
  const totalCents = (product.priceCents + product.shippingCents + product.taxEstimateCents) * quantity;
  return PurchaseSnapshotSchema.parse({
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
    quantity,
    hasSubscription: product.hasSubscription,
    subscriptionInfo: product.subscriptionInfo,
    snapshotCreatedAt: new Date().toISOString(),
  });
}
