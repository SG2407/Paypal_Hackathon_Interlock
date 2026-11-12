import { randomUUID } from 'node:crypto';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditEvent } from '@/lib/audit';
import { createPurchaseSnapshot, productFromRecord } from '@/lib/product-catalog';
import { createSandboxOrder, getSandboxOrder } from '@/lib/paypal';
import { evaluatePolicy } from '@/lib/policy-engine';
import { PermissionPolicySchema } from '@/types/policy';
import { CreateOrderRequestSchema } from '@/types/paypal';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsedRequest = CreateOrderRequestSchema.safeParse(body);
    if (!parsedRequest.success) {
      return NextResponse.json({ error: 'missionId and productId are required' }, { status: 400 });
    }

    const { missionId, productId } = parsedRequest.data;
    const mission = await prisma.shoppingMission.findUnique({
      where: { id: missionId },
      include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!mission || mission.status !== 'active') {
      return NextResponse.json({ error: 'Active mission not found' }, { status: 404 });
    }

    const policyRecord = mission.policies[0];
    if (!policyRecord?.confirmedAt) {
      return NextResponse.json({ error: 'A buyer-confirmed policy is required before checkout' }, { status: 409 });
    }
    const policy = PermissionPolicySchema.parse(JSON.parse(policyRecord.policyJson));
    if (!policy.requireHumanApproval) {
      return NextResponse.json({ error: 'Buyer approval is required for every purchase' }, { status: 409 });
    }

    const productRecord = await prisma.product.findUnique({ where: { id: productId } });
    if (!productRecord) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    const product = productFromRecord(productRecord);
    const evaluation = evaluatePolicy({ policy, product, policyVersion: policyRecord.version });
    if (evaluation.decision !== 'PASS') {
      return NextResponse.json({
        error: 'This product is not authorized by the confirmed policy. Review or update the policy before checkout.',
        policyDecision: evaluation.decision,
        evaluation,
      }, { status: 409 });
    }

    const existingOrder = await prisma.payPalOrder.findFirst({
      where: {
        missionId,
        productId,
        policyVersion: policyRecord.version,
        status: { in: ['created', 'approved', 'capturing'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (existingOrder) {
      const currentPayPalOrder = await getSandboxOrder(existingOrder.paypalOrderId);
      if (currentPayPalOrder.status !== 'CREATED' && currentPayPalOrder.status !== 'APPROVED') {
        return NextResponse.json({ error: 'An existing PayPal checkout is in progress. Return to PayPal or wait before retrying.' }, { status: 409 });
      }
      return NextResponse.json({
        success: true,
        orderId: existingOrder.id,
        paypalOrderId: existingOrder.paypalOrderId,
      });
    }

    const snapshot = createPurchaseSnapshot(product);
    const localOrderId = randomUUID();
    const { order } = await createSandboxOrder(localOrderId, missionId, snapshot);

    if (order.status !== 'CREATED'
      || order.intent !== 'CAPTURE'
      || order.purchase_units.length !== 1
      || order.purchase_units[0].custom_id !== localOrderId) {
      throw new Error('PayPal Sandbox returned an order that did not match the requested checkout.');
    }

    await prisma.payPalOrder.create({
      data: {
        id: localOrderId,
        missionId,
        productId,
        paypalOrderId: order.id,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
        purchaseSnapshotJson: JSON.stringify(snapshot),
        policyVersion: policyRecord.version,
        status: 'created',
      },
    });

    await createAuditEvent({
      missionId,
      eventType: 'order_created',
      eventData: {
        localOrderId,
        paypalOrderId: order.id,
        productId,
        productName: snapshot.productName,
        amountCents: snapshot.totalCents,
        currency: snapshot.currency,
        policyVersion: policyRecord.version,
      },
    });

    return NextResponse.json({
      success: true,
      orderId: localOrderId,
      paypalOrderId: order.id,
    });
  } catch (error) {
    console.error('PayPal Sandbox order creation failed:', error);
    const message = error instanceof Error ? error.message : 'Failed to create PayPal Sandbox order';
    const status = message.includes('credentials are not configured') || message.includes('APP_BASE_URL')
      ? 503
      : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
