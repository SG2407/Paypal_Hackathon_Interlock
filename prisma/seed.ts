/**
 * IntentLock Database Seed Script
 *
 * Seeds the database with demo products for the hackathon.
 * Includes test scenarios for PASS, REVIEW, and BLOCK decisions.
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Calculate delivery dates relative to current date
function getDeliveryDate(daysFromNow: number): Date {
  const date = new Date();
  date.setDate(date.getDate() + daysFromNow);
  date.setHours(17, 0, 0, 0); // Set to 5 PM
  return date;
}

// Get next Friday from today
function getNextFriday(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7 || 7;
  const friday = new Date(today);
  friday.setDate(today.getDate() + daysUntilFriday);
  friday.setHours(17, 0, 0, 0);
  return friday;
}

async function main() {
  console.log('🌱 Seeding IntentLock database...\n');

  // Create demo workspace
  const workspace = await prisma.demoWorkspace.upsert({
    where: { id: 'demo-workspace-1' },
    update: {},
    create: {
      id: 'demo-workspace-1',
      name: 'Demo User',
    },
  });
  console.log('✓ Created demo workspace:', workspace.id);

  // Clear existing products
  await prisma.product.deleteMany({});
  console.log('✓ Cleared existing products');

  // Seed products
  const products = [
    // Product A: BLOCK - Refurbished when new is required
    {
      id: 'prod-sony-wh1000xm5-refurb',
      sku: 'SONY-WH1000XM5-BLK-REFURB',
      name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
      brand: 'Sony',
      description: 'Premium noise cancelling headphones with industry-leading ANC. Factory refurbished with 90-day warranty.',
      category: 'headphones',
      color: 'black',
      condition: 'refurbished',
      priceCents: 15999, // $159.99
      shippingCents: 0, // Free shipping
      taxEstimateCents: 1280, // ~8% tax
      currency: 'USD',
      deliveryDate: getDeliveryDate(3), // Arrives in 3 days
      merchantId: 'merchant-tech-outlet',
      merchantName: 'Tech Outlet Store',
      imageUrl: '/images/sony-wh1000xm5-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '30 hours',
        weight: '250g',
      }),
      hasSubscription: false,
      subscriptionInfo: null,
    },
    // Product B: BLOCK - Exceeds budget
    {
      id: 'prod-sony-wh1000xm5-new-expensive',
      sku: 'SONY-WH1000XM5-BLK-NEW-PREMIUM',
      name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
      brand: 'Sony',
      description: 'Brand new premium noise cancelling headphones with full manufacturer warranty.',
      category: 'headphones',
      color: 'black',
      condition: 'new',
      priceCents: 17999, // $179.99
      shippingCents: 999, // $9.99 shipping
      taxEstimateCents: 1440, // ~8% tax on base
      currency: 'USD',
      deliveryDate: getDeliveryDate(2),
      merchantId: 'merchant-premium-audio',
      merchantName: 'Premium Audio Direct',
      imageUrl: '/images/sony-wh1000xm5-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '30 hours',
        weight: '250g',
      }),
      hasSubscription: false,
      subscriptionInfo: null,
    },
    // Product C: PASS - Compliant product
    {
      id: 'prod-sony-wh1000xm5-new-compliant',
      sku: 'SONY-WH1000XM5-BLK-NEW',
      name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
      brand: 'Sony',
      description: 'Brand new Sony WH-1000XM5 with industry-leading noise cancellation and exceptional sound quality.',
      category: 'headphones',
      color: 'black',
      condition: 'new',
      priceCents: 14999, // $149.99
      shippingCents: 799, // $7.99 shipping
      taxEstimateCents: 1200, // ~8% tax
      currency: 'USD',
      deliveryDate: getNextFriday(), // Arrives by the next Friday demo deadline
      merchantId: 'merchant-electronics-hub',
      merchantName: 'Electronics Hub',
      imageUrl: '/images/sony-wh1000xm5-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '30 hours',
        weight: '250g',
      }),
      hasSubscription: false,
      subscriptionInfo: null,
    },
    // Product D: BLOCK - Unauthorized subscription
    {
      id: 'prod-sony-wh1000xm5-subscription',
      sku: 'SONY-WH1000XM5-BLK-PLUS',
      name: 'Sony WH-1000XM5 with Sony 360 Reality Audio Plus Subscription',
      brand: 'Sony',
      description: 'Brand new Sony WH-1000XM5 bundled with Sony 360 Reality Audio Plus monthly subscription for enhanced spatial audio.',
      category: 'headphones',
      color: 'black',
      condition: 'new',
      priceCents: 14999, // $149.99
      shippingCents: 0,
      taxEstimateCents: 1200,
      currency: 'USD',
      deliveryDate: getDeliveryDate(2),
      merchantId: 'merchant-sony-official',
      merchantName: 'Sony Official Store',
      imageUrl: '/images/sony-wh1000xm5-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '30 hours',
        weight: '250g',
        bundle: 'Sony 360 Reality Audio Plus',
      }),
      hasSubscription: true,
      subscriptionInfo: JSON.stringify({
        monthlyPriceCents: 1999, // $19.99/month
        description: 'Sony 360 Reality Audio Plus - Premium spatial audio streaming',
      }),
    },
    // Product E: REVIEW/BLOCK - Different brand (Bose)
    {
      id: 'prod-bose-qc45-new',
      sku: 'BOSE-QC45-BLK-NEW',
      name: 'Bose QuietComfort 45 Wireless Noise Cancelling Headphones',
      brand: 'Bose',
      description: 'Premium Bose noise cancelling headphones with legendary comfort and sound quality.',
      category: 'headphones',
      color: 'black',
      condition: 'new',
      priceCents: 15999, // $159.99
      shippingCents: 0,
      taxEstimateCents: 1280,
      currency: 'USD',
      deliveryDate: getDeliveryDate(2),
      merchantId: 'merchant-bose-direct',
      merchantName: 'Bose Direct',
      imageUrl: '/images/bose-qc45-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '24 hours',
        weight: '240g',
      }),
      hasSubscription: false,
      subscriptionInfo: null,
    },
    // Product F: BLOCK - Late delivery
    {
      id: 'prod-sony-wh1000xm5-late',
      sku: 'SONY-WH1000XM5-BLK-BACKORDER',
      name: 'Sony WH-1000XM5 Wireless Noise Cancelling Headphones',
      brand: 'Sony',
      description: 'Brand new Sony WH-1000XM5 - currently on backorder with extended delivery time.',
      category: 'headphones',
      color: 'black',
      condition: 'new',
      priceCents: 13999, // $139.99 - discounted
      shippingCents: 0,
      taxEstimateCents: 1120,
      currency: 'USD',
      deliveryDate: getDeliveryDate(14), // 2 weeks out - after Friday deadline
      merchantId: 'merchant-discount-audio',
      merchantName: 'Discount Audio Warehouse',
      imageUrl: '/images/sony-wh1000xm5-black.jpg',
      attributesJson: JSON.stringify({
        noiseCancelling: 'yes',
        wireless: 'yes',
        batteryLife: '30 hours',
        weight: '250g',
      }),
      hasSubscription: false,
      subscriptionInfo: null,
    },
  ];

  for (const product of products) {
    await prisma.product.create({
      data: product,
    });
    console.log(`✓ Created product: ${product.name} (${product.condition}) - $${(product.priceCents / 100).toFixed(2)}`);
  }

  console.log(`\n✅ Seeded ${products.length} products`);

  // Print test scenario summary
  console.log('\n📋 Test Scenarios:');
  console.log('─────────────────────────────────────────────────────────────');
  console.log('Product A (Refurbished)     → Expected: BLOCK (condition)');
  console.log('Product B (Over Budget)     → Expected: BLOCK (budget)');
  console.log('Product C (Compliant)       → Expected: PASS');
  console.log('Product D (Subscription)    → Expected: BLOCK (subscription)');
  console.log('Product E (Bose Brand)      → Expected: BLOCK (brand)');
  console.log('Product F (Late Delivery)   → Expected: BLOCK (delivery)');
  console.log('─────────────────────────────────────────────────────────────');

  console.log('\n🎉 Database seeding complete!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
