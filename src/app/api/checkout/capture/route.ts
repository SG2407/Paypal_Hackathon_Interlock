import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditEvent } from '@/lib/audit';
import { productFromRecord } from '@/lib/product-catalog';
import {
  captureSandboxOrder,
  getCaptureFromCompletedOrder,
  getSandboxOrder,
} from '@/lib/paypal';
import { validateOrderForCapture } from '@/lib/policy-engine';
import { PermissionPolicySchema } from '@/types/policy';
import { PurchaseSnapshotSchema } from '@/types/product';
import type { PayPalAPICapture } from '@/types/paypal';

function captureAmountCents(capture: PayPalAPICapture): number | null {
  if (!/^\d+(?:\.\d{1,2})?$/.test(capture.amount.value)) return null;
  const cents = Math.round(Number(capture.amount.value) * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function captureMatchesSnapshot(capture: PayPalAPICapture, totalCents: number, currency: string): boolean {
  return captureAmountCents(capture) === totalCents && capture.amount.currency_code === currency;
}

async function ensureCapturedAudit(
  missionId: string,
  localOrderId: string,
  paypalOrderId: string,
  captureId: string,
  amountCents: number | null,
  currency: string,
) {
  const events = await prisma.auditEvent.findMany({
    where: { missionId, eventType: 'order_captured' },
    select: { eventData: true },
  });
  if (events.some((event) => {
    try {
      return JSON.parse(event.eventData).localOrderId === localOrderId;
    } catch {
      return false;
    }
  })) return;

  await createAuditEvent({
    missionId,
    eventType: 'order_captured',
    eventData: { localOrderId, paypalOrderId, captureId, actualAmountCents: amountCents, currency },
  });
}

async function ensureCaptureMismatchAudit(
  missionId: string,
  localOrderId: string,
  paypalOrderId: string,
  captureId: string,
  expectedAmountCents: number,
  actualAmountCents: number | null,
  expectedCurrency: string,
  actualCurrency: string,
) {
  const events = await prisma.auditEvent.findMany({
    where: { missionId, eventType: 'tampering_detected' },
    select: { eventData: true },
  });
  if (events.some((event) => {
    try {
      return JSON.parse(event.eventData).localOrderId === localOrderId;
    } catch {
      return false;
    }
  })) return;

  await createAuditEvent({
    missionId,
    eventType: 'tampering_detected',
    eventData: {
      localOrderId,
      paypalOrderId,
      captureId,
      expectedAmountCents,
      actualAmountCents,
      expectedCurrency,
      actualCurrency,
    },
  });
}

async function ensureApprovedAudit(
  missionId: string,
  localOrderId: string,
  paypalOrderId: string,
  policyVersion: number,
  evaluation: unknown,
) {
  const events = await prisma.auditEvent.findMany({
    where: { missionId, eventType: 'order_approved' },
    select: { eventData: true },
  });
  if (events.some((event) => {
    try {
      return JSON.parse(event.eventData).localOrderId === localOrderId;
    } catch {
      return false;
    }
  })) return;

  await createAuditEvent({
    missionId,
    eventType: 'order_approved',
    eventData: { localOrderId, paypalOrderId, policyVersion, evaluation },
  });
}

async function blockOrder(
  order: { id: string; missionId: string; paypalOrderId: string },
  reason: string,
  evaluation?: unknown,
) {
  await prisma.payPalOrder.update({
    where: { id: order.id },
    data: { status: 'blocked' },
  });
  await createAuditEvent({
    missionId: order.missionId,
    eventType: 'order_blocked',
    eventData: {
      localOrderId: order.id,
      paypalOrderId: order.paypalOrderId,
      reason,
      evaluation,
    },
  });
}

async function persistCapture(
  order: { id: string; missionId: string; paypalOrderId: string },
  capture: PayPalAPICapture,
  amountCents: number | null,
) {
  const capturedAt = capture.create_time ? new Date(capture.create_time) : new Date();
  await prisma.$transaction([
    prisma.payPalOrder.update({
      where: { id: order.id },
      data: {
        status: 'captured',
        captureId: capture.id,
        captureStatus: capture.status,
        captureAmountCents: amountCents,
        captureCurrency: capture.amount.currency_code,
        capturedAt,
      },
    }),
    prisma.shoppingMission.update({
      where: { id: order.missionId },
      data: { status: 'completed' },
    }),
  ]);
  await ensureCapturedAudit(
    order.missionId,
    order.id,
    order.paypalOrderId,
    capture.id,
    amountCents,
    capture.amount.currency_code,
  );
}

async function persistUnverifiedCompletedOrder(order: { id: string; missionId: string; paypalOrderId: string }) {
  await prisma.$transaction([
    prisma.payPalOrder.update({
      where: { id: order.id },
      data: { status: 'captured', captureStatus: 'COMPLETED_UNVERIFIED', capturedAt: new Date() },
    }),
    prisma.shoppingMission.update({
      where: { id: order.missionId },
      data: { status: 'completed' },
    }),
  ]);
  await createAuditEvent({
    missionId: order.missionId,
    eventType: 'tampering_detected',
    eventData: {
      localOrderId: order.id,
      paypalOrderId: order.paypalOrderId,
      reason: 'PayPal reports a completed order but returned no verifiable capture record',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const paypalOrderId = typeof body === 'object' && body !== null && 'orderId' in body
      ? (body as { orderId?: unknown }).orderId
      : undefined;
    if (typeof paypalOrderId !== 'string' || paypalOrderId.length < 1 || paypalOrderId.length > 127) {
      return NextResponse.json({ error: 'A valid PayPal orderId is required' }, { status: 400 });
    }

    const localOrder = await prisma.payPalOrder.findUnique({ where: { paypalOrderId } });
    if (!localOrder) return NextResponse.json({ error: 'PayPal order is not associated with an IntentLock checkout' }, { status: 404 });

    if (localOrder.status === 'captured') {
      if (!localOrder.captureId) {
        return NextResponse.json({
          error: 'PayPal reports this order as captured, but no verifiable capture receipt is available',
          captured: true,
        }, { status: 409 });
      }
      await ensureCapturedAudit(
        localOrder.missionId,
        localOrder.id,
        localOrder.paypalOrderId,
        localOrder.captureId,
        localOrder.captureAmountCents,
        localOrder.captureCurrency ?? localOrder.currency,
      );
      const captureMatches = localOrder.captureAmountCents === localOrder.amountCents
        && localOrder.captureCurrency === localOrder.currency
        && localOrder.captureStatus === 'COMPLETED';
      if (!captureMatches) {
        await ensureCaptureMismatchAudit(
          localOrder.missionId,
          localOrder.id,
          localOrder.paypalOrderId,
          localOrder.captureId,
          localOrder.amountCents,
          localOrder.captureAmountCents,
          localOrder.currency,
          localOrder.captureCurrency ?? 'UNKNOWN',
        );
        return NextResponse.json({
          error: 'PayPal captured an amount or currency different from the authorized order',
          captured: true,
          captureId: localOrder.captureId,
          amountCents: localOrder.captureAmountCents,
          currency: localOrder.captureCurrency,
        }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        missionId: localOrder.missionId,
        paypalOrderId,
        captureId: localOrder.captureId,
        amountCents: localOrder.captureAmountCents,
        currency: localOrder.captureCurrency,
      });
    }
    if (localOrder.status === 'blocked') {
      return NextResponse.json({ error: 'This checkout was blocked and cannot be captured' }, { status: 409 });
    }

    const [mission, productRecord] = await Promise.all([
      prisma.shoppingMission.findUnique({
        where: { id: localOrder.missionId },
        include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
      }),
      prisma.product.findUnique({ where: { id: localOrder.productId } }),
    ]);
    if (!mission || !productRecord || mission.status !== 'active') {
      await blockOrder(localOrder, 'Mission is no longer active or the canonical product is missing');
      return NextResponse.json({ error: 'Mission is no longer eligible for capture' }, { status: 409 });
    }

    const policyRecord = mission.policies[0];
    if (!policyRecord?.confirmedAt || policyRecord.version !== localOrder.policyVersion) {
      await blockOrder(localOrder, 'The checkout policy is unconfirmed or no longer current');
      return NextResponse.json({ error: 'The confirmed policy changed after checkout; create a new order' }, { status: 409 });
    }
    const policy = PermissionPolicySchema.parse(JSON.parse(policyRecord.policyJson));
    if (!policy.requireHumanApproval) {
      await blockOrder(localOrder, 'Buyer approval is required for every purchase');
      return NextResponse.json({ error: 'Buyer approval is required for every purchase' }, { status: 409 });
    }

    const product = productFromRecord(productRecord);
    const snapshot = PurchaseSnapshotSchema.parse(JSON.parse(localOrder.purchaseSnapshotJson));
    if (snapshot.totalCents !== localOrder.amountCents || snapshot.currency !== localOrder.currency) {
      await blockOrder(localOrder, 'Stored order amount or currency does not match the purchase snapshot');
      return NextResponse.json({ error: 'Stored order details failed validation' }, { status: 409 });
    }

    const paypalOrder = await getSandboxOrder(paypalOrderId);
    const recoveringCapture = localOrder.status === 'capturing' && paypalOrder.status === 'COMPLETED';
    if (paypalOrder.status !== 'APPROVED' && !recoveringCapture) {
      return NextResponse.json({ error: 'PayPal has not confirmed buyer approval for this order' }, { status: 409 });
    }
    const evaluation = validateOrderForCapture({
      policy,
      product,
      purchaseSnapshot: snapshot,
      paypalOrder,
      policyVersion: policyRecord.version,
      localOrderId: localOrder.id,
      expectedPaypalOrderId: localOrder.paypalOrderId,
      allowCompletedOrder: recoveringCapture,
    });

    if (evaluation.decision !== 'PASS') {
      await blockOrder(localOrder, 'PayPal order failed the pre-capture authorization checks', evaluation);
      return NextResponse.json({
        error: 'Payment was blocked by the confirmed policy or order-integrity checks',
        blocked: true,
        evaluation,
      }, { status: 409 });
    }

    if (recoveringCapture) {
      const capture = getCaptureFromCompletedOrder(paypalOrder);
      if (!capture) {
        await persistUnverifiedCompletedOrder(localOrder);
        return NextResponse.json({
          error: 'PayPal reports this order as completed, but no verifiable capture receipt was returned',
          captured: true,
        }, { status: 409 });
      }
      const actualAmount = captureAmountCents(capture);
      await persistCapture(localOrder, capture, actualAmount);
      if (!captureMatchesSnapshot(capture, snapshot.totalCents, snapshot.currency)) {
        await ensureCaptureMismatchAudit(localOrder.missionId, localOrder.id, paypalOrderId, capture.id, snapshot.totalCents, actualAmount, snapshot.currency, capture.amount.currency_code);
        return NextResponse.json({ error: 'PayPal completed the capture, but its receipt differs from the authorized amount', blocked: true }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        missionId: localOrder.missionId,
        paypalOrderId,
        captureId: capture.id,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
      });
    }

    if (!localOrder.buyerApprovedAt) {
      await prisma.payPalOrder.update({
        where: { id: localOrder.id },
        data: { buyerApprovedAt: new Date(), status: 'approved' },
      });
    }
    await ensureApprovedAudit(localOrder.missionId, localOrder.id, paypalOrderId, policyRecord.version, evaluation);

    await prisma.payPalOrder.update({
      where: { id: localOrder.id },
      data: { status: 'capturing' },
    });
    const capture = await captureSandboxOrder(paypalOrderId, localOrder.id);
    const actualAmount = captureAmountCents(capture);
    await persistCapture(localOrder, capture, actualAmount);
    if (!captureMatchesSnapshot(capture, snapshot.totalCents, snapshot.currency)) {
      await ensureCaptureMismatchAudit(localOrder.missionId, localOrder.id, paypalOrderId, capture.id, snapshot.totalCents, actualAmount, snapshot.currency, capture.amount.currency_code);
      return NextResponse.json({ error: 'PayPal completed the capture, but its receipt differs from the authorized amount', blocked: true }, { status: 409 });
    }
    return NextResponse.json({
      success: true,
      missionId: localOrder.missionId,
      paypalOrderId,
      captureId: capture.id,
      amountCents: actualAmount,
      currency: capture.amount.currency_code,
    });
  } catch (error) {
    console.error('PayPal Sandbox capture failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to capture PayPal Sandbox order';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
