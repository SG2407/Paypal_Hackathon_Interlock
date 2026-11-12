import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const mission = await prisma.shoppingMission.findUnique({
      where: { id },
      include: {
        policies: { orderBy: { version: 'desc' }, take: 1 },
      },
    });

    if (!mission) {
      return NextResponse.json(
        { error: 'Mission not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      mission: {
        id: mission.id,
        intent: mission.originalPrompt,
        status: mission.status,
        policy: mission.policies[0] ? JSON.parse(mission.policies[0].policyJson) : {},
        createdAt: mission.createdAt.toISOString(),
      },
    });
  } catch (error) {
    console.error('Failed to fetch mission:', error);
    return NextResponse.json(
      { error: 'Failed to fetch mission' },
      { status: 500 }
    );
  }
}
