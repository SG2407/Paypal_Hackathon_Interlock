import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { evaluatePolicy } from '@/lib/policy-engine';
import { PermissionPolicySchema } from '@/types/policy';
import { productFromRecord } from '@/lib/product-catalog';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { missionId, productId } = body;

    if (typeof missionId !== 'string' || typeof productId !== 'string') {
      return NextResponse.json(
        { error: 'missionId and productId are required' },
        { status: 400 }
      );
    }

    const [mission, row] = await Promise.all([
      prisma.shoppingMission.findUnique({
        where: { id: missionId },
        include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
      }),
      prisma.product.findUnique({ where: { id: productId } }),
    ]);

    if (!mission?.policies[0]?.confirmedAt || !row) {
      return NextResponse.json({ error: 'Mission, confirmed policy, or product not found' }, { status: 404 });
    }

    const policy = PermissionPolicySchema.parse(JSON.parse(mission.policies[0].policyJson));
    const product = productFromRecord(row);
    const result = evaluatePolicy({ policy, product, policyVersion: mission.policies[0].version });

    return NextResponse.json({ result });
  } catch (error) {
    console.error('Policy validation error:', error);
    return NextResponse.json(
      { error: 'Failed to validate policy' },
      { status: 500 }
    );
  }
}
