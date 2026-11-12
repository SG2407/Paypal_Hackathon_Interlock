import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { createAuditEvent } from '@/lib/audit';
import { getOpenRouterModel } from '@/lib/ai/client';
import { IntentCompilationResponseSchema, PermissionPolicySchema } from '@/types/policy';

// Ensure demo workspace exists
async function ensureDemoWorkspace() {
  const workspace = await prisma.demoWorkspace.findFirst();
  if (workspace) return workspace;

  return prisma.demoWorkspace.create({
    data: { name: 'Demo User' },
  });
}

export async function GET() {
  try {
    const missions = await prisma.shoppingMission.findMany({
      orderBy: { createdAt: 'desc' },
      include: { policies: { orderBy: { version: 'desc' }, take: 1 } },
      take: 50,
    });

    return NextResponse.json({
      missions: missions.map((m) => ({
        id: m.id,
        intent: m.originalPrompt,
        status: m.status,
        policy: m.policies[0] ? JSON.parse(m.policies[0].policyJson) : {},
        createdAt: m.createdAt.toISOString(),
      })),
    });
  } catch (error) {
    console.error('Failed to fetch missions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch missions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (typeof body !== 'object' || body === null) {
      return NextResponse.json({ error: 'Request must be a JSON object' }, { status: 400 });
    }
    const { intent, policy } = body;

    if (typeof intent !== 'string' || intent.trim().length < 5 || intent.length > 2000) {
      return NextResponse.json(
        { error: 'Intent must be between 5 and 2,000 characters' },
        { status: 400 }
      );
    }
    if (typeof policy !== 'object' || policy === null) {
      return NextResponse.json({ error: 'A buyer-confirmed policy is required' }, { status: 400 });
    }

    const policyResult = PermissionPolicySchema.safeParse({
      ...policy,
      requireHumanApproval: true,
    });
    if (!policyResult.success) {
      return NextResponse.json({ error: 'Policy is invalid or incomplete' }, { status: 400 });
    }
    const confirmedPolicy = policyResult.data;
    const compilation = IntentCompilationResponseSchema.safeParse(body.compilationResult);

    const workspace = await ensureDemoWorkspace();

    const mission = await prisma.shoppingMission.create({
      data: {
        workspaceId: workspace.id,
        originalPrompt: intent,
        status: 'active',
        policies: {
          create: {
            policyJson: JSON.stringify(confirmedPolicy),
            version: 1,
            confirmedAt: new Date(),
          },
        },
        aiExecutions: compilation.success ? {
          create: {
            taskType: 'intent_compilation',
            model: getOpenRouterModel(),
            inputJson: JSON.stringify({ intent }),
            outputJson: JSON.stringify(compilation.data),
          },
        } : undefined,
      },
      include: { policies: true },
    });

    return NextResponse.json({
      mission: {
        id: mission.id,
        intent: mission.originalPrompt,
        status: mission.status,
        policy: confirmedPolicy,
        createdAt: mission.createdAt.toISOString(),
      },
    });
    await createAuditEvent({
      missionId: mission.id,
      eventType: 'mission_created',
      eventData: { missionId: mission.id, promptLength: intent.length },
    });
    await createAuditEvent({
      missionId: mission.id,
      eventType: 'policy_confirmed',
      eventData: { missionId: mission.id, policyVersion: mission.policies[0].version },
    });
  } catch (error) {
    console.error('Failed to create mission:', error);
    return NextResponse.json(
      { error: 'Failed to create mission' },
      { status: 500 }
    );
  }
}
