import { NextRequest, NextResponse } from 'next/server';
import { processShoppingIntent } from '@/lib/ai';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { intent, clarifications } = body;

    if (typeof intent !== 'string' || intent.trim().length < 5 || intent.length > 2000) {
      return NextResponse.json(
        { error: 'Intent must be between 5 and 2,000 characters' },
        { status: 400 }
      );
    }
    if (clarifications !== undefined && (typeof clarifications !== 'string' || clarifications.length > 4000)) {
      return NextResponse.json({ error: 'Clarifications must be text no longer than 4,000 characters' }, { status: 400 });
    }

    // Combine intent with any clarifications
    const fullIntent = clarifications
      ? `${intent}. Additional details: ${clarifications}`
      : intent;

    const result = await processShoppingIntent(fullIntent);

    return NextResponse.json(result);
  } catch (error) {
    console.error('Intent compilation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to compile intent';
    const status = message.includes('OPENAI_API_KEY') ? 503 : 502;
    return NextResponse.json(
      { error: message },
      { status }
    );
  }
}
