import { z } from 'zod';
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditEvent } from '@/lib/audit';
import { productFromRecord } from '@/lib/product-catalog';
import { evaluatePolicy } from '@/lib/policy-engine';
import { PermissionPolicySchema } from '@/types/policy';

const RequestSchema = z.object({
  missionId: z.string().min(1),
  productId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();
    const input = RequestSchema.safeParse(body);
    if (!input.success) {
      return NextResponse.json({ error: 'missionId and productId are required' }, { status: 400 });
    }

    const [mission, productRecord] = await Promise.all([
      prisma.shoppingMission.findUnique({
        where: { id: input.data.missionId },
        include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
      }),
      prisma.product.findUnique({ where: { id: input.data.productId } }),
    ]);
    const currentPolicyRecord = mission?.policies[0];
    if (!mission || mission.status !== 'active' || !currentPolicyRecord?.confirmedAt || !productRecord) {
      return NextResponse.json({ error: 'Active mission, confirmed policy, or product not found' }, { status: 404 });
    }

    const policy = PermissionPolicySchema.parse(JSON.parse(currentPolicyRecord.policyJson));
    if (!policy.requireHumanApproval) {
      return NextResponse.json({ error: 'Buyer approval is required for every purchase' }, { status: 409 });
    }
    const product = productFromRecord(productRecord);
    const currentEvaluation = evaluatePolicy({
      policy,
      product,
      policyVersion: currentPolicyRecord.version,
    });
    if (currentEvaluation.decision !== 'REVIEW' || currentEvaluation.violations.length > 0) {
      return NextResponse.json({
        error: 'Only reviewable warnings can be approved. Blocking policy violations cannot be overridden.',
        evaluation: currentEvaluation,
      }, { status: 409 });
    }

    const version = currentPolicyRecord.version + 1;
    const approvalReason = currentEvaluation.warnings.map((warning) => warning.explanation).join('; ');
    const approvedAt = new Date().toISOString();
    const updatedPolicy = PermissionPolicySchema.parse({
      ...policy,
      approvedProducts: [
        ...policy.approvedProducts.filter((approval) => approval.productId !== product.id),
        { productId: product.id, approvalReason, approvedAt },
      ],
    });
    const evaluation = evaluatePolicy({ policy: updatedPolicy, product, policyVersion: version });
    if (evaluation.decision !== 'PASS') {
      return NextResponse.json({
        error: 'The product still fails a mandatory policy check and cannot be authorized',
        evaluation,
      }, { status: 409 });
    }

    await prisma.permissionPolicy.create({
      data: {
        missionId: mission.id,
        version,
        policyJson: JSON.stringify(updatedPolicy),
        confirmedAt: new Date(approvedAt),
      },
    });
    await createAuditEvent({
      missionId: mission.id,
      eventType: 'policy_updated',
      eventData: {
        policyVersion: version,
        approvedProductId: product.id,
        productSku: product.sku,
        approvalReason,
        approvedAt,
      },
    });

    return NextResponse.json({ policy: updatedPolicy, evaluation });
  } catch (error) {
    console.error('Failed to record buyer product exception:', error);
    return NextResponse.json({ error: 'Failed to record buyer-confirmed product exception' }, { status: 500 });
  }
}
