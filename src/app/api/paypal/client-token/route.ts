import { connection, NextResponse } from 'next/server';
import { getBrowserSafeClientToken } from '@/lib/paypal';

export async function GET() {
  await connection();
  try {
    const clientToken = await getBrowserSafeClientToken();
    return NextResponse.json({ clientToken }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    console.error('PayPal SDK client-token request failed:', error);
    const message = error instanceof Error ? error.message : 'PayPal Sandbox client token is unavailable';
    const status = message.includes('credentials are not configured') ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
