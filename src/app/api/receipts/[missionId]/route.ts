import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyMissionAuditChain } from '@/lib/audit';
import { IntentReceiptSchema } from '@/types/audit';
import { PurchaseSnapshotSchema } from '@/types/product';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ missionId: string }> },
) {
  try {
    const { missionId } = await params;
    const [mission, order, auditEvents, auditVerification] = await Promise.all([
      prisma.shoppingMission.findUnique({
        where: { id: missionId },
        include: {
          policies: { where: { confirmedAt: { not: null } }, orderBy: { version: 'desc' }, take: 1 },
          recommendations: { orderBy: { createdAt: 'desc' }, take: 20 },
        },
      }),
      prisma.payPalOrder.findFirst({
        where: { missionId, status: 'captured' },
        orderBy: { capturedAt: 'desc' },
        include: { product: true },
      }),
      prisma.auditEvent.findMany({
        where: { missionId },
        orderBy: { createdAt: 'asc' },
      }),
      verifyMissionAuditChain(missionId),
    ]);

    if (!mission || !order) {
      return NextResponse.json({ error: 'A completed transaction receipt was not found' }, { status: 404 });
    }
    if (!order.captureId || order.captureStatus !== 'COMPLETED'
      || order.captureAmountCents !== order.amountCents
      || order.captureCurrency !== order.currency
      || !order.buyerApprovedAt
      || !order.capturedAt) {
      return NextResponse.json({ error: 'The transaction does not have a verified capture receipt' }, { status: 409 });
    }

    const policyRecord = mission.policies.find((policy) => policy.version === order.policyVersion);
    if (!policyRecord) {
      return NextResponse.json({ error: 'The confirmed policy version for this transaction is unavailable' }, { status: 409 });
    }
    const snapshot = PurchaseSnapshotSchema.parse(JSON.parse(order.purchaseSnapshotJson));
    const approvalEvent = auditEvents.find((event) => {
      if (event.eventType !== 'order_approved') return false;
      try {
        return JSON.parse(event.eventData).localOrderId === order.id;
      } catch {
        return false;
      }
    });
    const validationResults = approvalEvent
      ? JSON.parse(approvalEvent.eventData).evaluation
      : undefined;
    if (!validationResults || validationResults.decision !== 'PASS') {
      return NextResponse.json({ error: 'The pre-capture validation record is unavailable or invalid' }, { status: 409 });
    }

    const recommendation = mission.recommendations.find((item) => item.productId === order.productId);
    const receipt = IntentReceiptSchema.parse({
      missionId: mission.id,
      originalPrompt: mission.originalPrompt,
      confirmedPolicy: JSON.parse(policyRecord.policyJson),
      policyVersion: policyRecord.version,
      product: {
        id: snapshot.productId,
        name: snapshot.productName,
        brand: snapshot.productBrand,
        sku: snapshot.productSku,
        priceCents: snapshot.priceCents,
        shippingCents: snapshot.shippingCents,
        taxEstimateCents: snapshot.taxEstimateCents,
        totalCents: snapshot.totalCents,
        currency: snapshot.currency,
      },
      paypalOrderId: order.paypalOrderId,
      paypalCaptureId: order.captureId,
      transactionStatus: order.captureStatus,
      buyerApprovedAt: order.buyerApprovedAt.toISOString(),
      capturedAt: order.capturedAt.toISOString(),
      aiRecommendationExplanation: recommendation?.aiExplanation ?? null,
      policyValidationResults: validationResults,
      auditVerification,
      auditTimeline: auditEvents.map((event) => ({
        id: event.id,
        missionId: event.missionId,
        eventType: event.eventType,
        eventData: JSON.parse(event.eventData),
        previousHash: event.previousHash,
        eventHash: event.eventHash,
        createdAt: event.createdAt.toISOString(),
      })),
    });

    return NextResponse.json(receipt, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    console.error('Failed to build transaction receipt:', error);
    return NextResponse.json({ error: 'Failed to build transaction receipt' }, { status: 500 });
  }
}
