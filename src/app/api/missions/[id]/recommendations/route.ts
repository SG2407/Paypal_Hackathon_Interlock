import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { recommendProducts } from '@/lib/ai';
import { createAuditEvent } from '@/lib/audit';
import { PermissionPolicySchema } from '@/types/policy';
import { evaluatePolicy } from '@/lib/policy-engine';
import { productFromRecord } from '@/lib/product-catalog';
import { getOpenRouterModel } from '@/lib/ai/client';

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const mission = await prisma.shoppingMission.findUnique({
      where: { id },
      include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
    });
    if (!mission || !mission.policies[0]?.confirmedAt) {
      return NextResponse.json({ error: 'Confirmed mission policy not found' }, { status: 404 });
    }

    const policy = PermissionPolicySchema.parse(JSON.parse(mission.policies[0].policyJson));
    const rows = await prisma.product.findMany({ orderBy: { name: 'asc' } });
    const products = rows.map(productFromRecord);
    const ai = await recommendProducts({ policy, products, maxRecommendations: products.length });
    const aiByProductId = new Map(ai.recommendations.map((recommendation) => [recommendation.productId, recommendation]));

    const recommendations = products.map((product) => {
      const recommendation = aiByProductId.get(product.id);
      const evaluation = evaluatePolicy({ policy, product, policyVersion: mission.policies[0].version });
      return {
        product,
        aiRank: recommendation?.rank ?? null,
        aiExplanation: recommendation?.explanation ?? 'Not included in the AI ranking; shown for policy comparison.',
        evaluation,
      };
    }).sort((a, b) => {
      if (a.aiRank === null) return b.aiRank === null ? 0 : 1;
      if (b.aiRank === null) return -1;
      return a.aiRank - b.aiRank;
    });

    await prisma.shoppingRecommendation.deleteMany({ where: { missionId: id } });
    await prisma.shoppingRecommendation.createMany({
      data: recommendations.map((item, index) => ({
        missionId: id,
        productId: item.product.id,
        aiRank: item.aiRank ?? products.length + index + 1,
        aiExplanation: item.aiExplanation,
        policyDecision: item.evaluation.decision,
        evaluationJson: JSON.stringify(item.evaluation),
      })),
    });
    await prisma.aIExecution.create({
      data: {
        missionId: id,
        taskType: 'product_recommendation',
        model: getOpenRouterModel(),
        inputJson: JSON.stringify({ policyVersion: mission.policies[0].version, productIds: products.map(({ id: productId }) => productId) }),
        outputJson: JSON.stringify(ai),
      },
    });
    await createAuditEvent({
      missionId: id,
      eventType: 'products_recommended',
      eventData: {
        policyVersion: mission.policies[0].version,
        productIds: recommendations.map(({ product }) => product.id),
      },
    });

    return NextResponse.json({ recommendations, reasoning: ai.reasoning });
  } catch (error) {
    console.error('Failed to generate recommendations:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate recommendations';
    const status = message.includes('OPENROUTER_API_KEY') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
