import type { Product, PurchaseSnapshot } from '@/types/product';

export const DEMO_SUBSCRIPTION_MONTHLY_CENTS = 1999;

export function simulateUnauthorizedSubscription(product: Product, snapshot: PurchaseSnapshot) {
  const subscriptionInfo = {
    monthlyPriceCents: DEMO_SUBSCRIPTION_MONTHLY_CENTS,
    description: 'Simulated recurring audio subscription',
  };

  return {
    product: { ...product, hasSubscription: true, subscriptionInfo },
    purchaseSnapshot: { ...snapshot, hasSubscription: true, subscriptionInfo },
  };
}
