import { connection, NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { verifyAuditChain } from '@/lib/audit';

export async function GET(request: NextRequest) {
  await connection();
  try {
    const searchParams = request.nextUrl.searchParams;
    const missionId = searchParams.get('missionId');
    const requestedLimit = Number(searchParams.get('limit') || '50');
    const limit = Number.isInteger(requestedLimit) ? Math.min(200, Math.max(1, requestedLimit)) : 50;

    const where = missionId ? { missionId } : {};

    const [events, verification] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take: limit,
      }),
      verifyAuditChain(),
    ]);

    return NextResponse.json({
      verification,
      records: events.map((e) => {
        const eventData = JSON.parse(e.eventData);
        const amountCents = typeof eventData.amountCents === 'number'
          ? eventData.amountCents
          : typeof eventData.actualAmountCents === 'number' ? eventData.actualAmountCents : undefined;
        return {
        id: e.id,
        missionId: e.missionId ?? 'system',
        type: e.eventType,
        timestamp: e.createdAt.toISOString(),
        data: {
          ...eventData,
          amount: amountCents === undefined ? undefined : amountCents / 100,
          hash: e.eventHash,
          previousHash: e.previousHash,
        },
      };
      }),
    });
  } catch (error) {
    console.error('Failed to fetch audit history:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit history' },
      { status: 500 }
    );
  }
}
