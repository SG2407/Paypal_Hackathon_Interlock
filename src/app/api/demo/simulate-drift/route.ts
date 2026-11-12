import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { createAuditEvent } from '@/lib/audit';
import { simulateUnauthorizedSubscription } from '@/lib/demo/simulate-drift';
import { productFromRecord } from '@/lib/product-catalog';
import { validateOrderForCapture } from '@/lib/policy-engine';
import { getSandboxOrder } from '@/lib/paypal';
import { PermissionPolicySchema } from '@/types/policy';
import { PurchaseSnapshotSchema } from '@/types/product';

const RequestSchema = z.object({ orderId: z.string().min(1).max(127) });

export async function POST(request: NextRequest) {
  if (process.env.INTENTLOCK_DEMO_MODE !== 'true') {
    return NextResponse.json({ error: 'The cart-drift demonstration is disabled' }, { status: 404 });
  }

  try {
    const body: unknown = await request.json();
    const input = RequestSchema.safeParse(body);
    if (!input.success) return NextResponse.json({ error: 'A valid PayPal orderId is required' }, { status: 400 });

    const localOrder = await prisma.payPalOrder.findUnique({
      where: { paypalOrderId: input.data.orderId },
    });
    if (!localOrder) {
      return NextResponse.json({ error: 'PayPal order is not associated with an IntentLock checkout' }, { status: 404 });
    }
    if (localOrder.status === 'blocked' || localOrder.status === 'captured') {
      return NextResponse.json({ error: 'This order is already blocked or captured' }, { status: 409 });
    }

    const [mission, productRecord, paypalOrder] = await Promise.all([
      prisma.shoppingMission.findUnique({
        where: { id: localOrder.missionId },
        include: { policies: { where: { version: localOrder.policyVersion }, take: 1 } },
      }),
      prisma.product.findUnique({ where: { id: localOrder.productId } }),
      getSandboxOrder(localOrder.paypalOrderId),
    ]);
    const policyRecord = mission?.policies[0];
    if (!mission || mission.status !== 'active' || !policyRecord?.confirmedAt || !productRecord) {
      return NextResponse.json({ error: 'Active mission, confirmed policy, or product not found' }, { status: 409 });
    }
    if (paypalOrder.id !== localOrder.paypalOrderId
      || paypalOrder.status !== 'APPROVED'
      || paypalOrder.purchase_units[0]?.custom_id !== localOrder.id) {
      return NextResponse.json({ error: 'A buyer-approved, matching PayPal Sandbox order is required for this demonstration' }, { status: 409 });
    }

    const policy = PermissionPolicySchema.parse(JSON.parse(policyRecord.policyJson));
    const product = productFromRecord(productRecord);
    const snapshot = PurchaseSnapshotSchema.parse(JSON.parse(localOrder.purchaseSnapshotJson));
    if (!policy.requireHumanApproval
      || snapshot.hasSubscription
      || snapshot.totalCents !== localOrder.amountCents
      || snapshot.currency !== localOrder.currency) {
      return NextResponse.json({ error: 'The original order does not match the confirmed buyer permission' }, { status: 409 });
    }

    const originalEvaluation = validateOrderForCapture({
      policy,
      product,
      purchaseSnapshot: snapshot,
      paypalOrder,
      policyVersion: localOrder.policyVersion,
      localOrderId: localOrder.id,
      expectedPaypalOrderId: localOrder.paypalOrderId,
    });
    if (originalEvaluation.decision !== 'PASS') {
      return NextResponse.json({
        error: 'The original PayPal order does not pass buyer permission validation',
        evaluation: originalEvaluation,
      }, { status: 409 });
    }

    const simulated = simulateUnauthorizedSubscription(product, snapshot);
    const evaluation = validateOrderForCapture({
      policy,
      product: simulated.product,
      purchaseSnapshot: simulated.purchaseSnapshot,
      paypalOrder,
      policyVersion: localOrder.policyVersion,
      localOrderId: localOrder.id,
      expectedPaypalOrderId: localOrder.paypalOrderId,
    });
    if (evaluation.decision !== 'BLOCK') {
      throw new Error('The unauthorized subscription drift was not blocked by policy validation.');
    }

    await prisma.payPalOrder.update({
      where: { id: localOrder.id },
      data: { status: 'blocked' },
    });
    await createAuditEvent({
      missionId: mission.id,
      eventType: 'tampering_detected',
      eventData: {
        localOrderId: localOrder.id,
        paypalOrderId: localOrder.paypalOrderId,
        simulation: 'unauthorized_subscription_added',
        originalProductId: product.id,
        originalAmountCents: snapshot.totalCents,
        originalCurrency: snapshot.currency,
        addedMonthlyPriceCents: simulated.product.subscriptionInfo?.monthlyPriceCents,
        addedSubscription: simulated.product.subscriptionInfo?.description,
        decision: evaluation.decision,
        captureAttempted: false,
        paypalOrderResponseModified: false,
      },
    });

    return NextResponse.json({
      blocked: true,
      captureAttempted: false,
      paypalOrderId: localOrder.paypalOrderId,
      originalPurchase: {
        productName: snapshot.productName,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
        hasSubscription: snapshot.hasSubscription,
      },
      originalEvaluation,
      changedPurchase: {
        productName: snapshot.productName,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
        hasSubscription: simulated.purchaseSnapshot.hasSubscription,
        subscription: simulated.purchaseSnapshot.subscriptionInfo,
      },
      evaluation,
    });
  } catch (error) {
    console.error('Cart-drift demonstration failed:', error);
    return NextResponse.json({ error: 'Could not validate the simulated cart modification' }, { status: 500 });
  }
}
