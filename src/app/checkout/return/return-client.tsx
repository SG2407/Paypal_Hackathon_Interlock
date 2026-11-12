'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { AlertCircle, CheckCircle, Loader2 } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';

interface Receipt {
  missionId: string;
  paypalOrderId: string;
  captureId: string;
  amountCents: number;
}

export default function CheckoutReturn({ paypalOrderId }: { paypalOrderId: string }) {
  const [receipt, setReceipt] = useState<Receipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const displayError = error ?? (!paypalOrderId ? 'PayPal did not return an order reference. No capture was attempted.' : null);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    if (!paypalOrderId) return;

    void (async () => {
      try {
        const response = await fetch('/api/checkout/capture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ orderId: paypalOrderId }),
        });
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'PayPal capture was not confirmed.');
        setReceipt(data);
      } catch (captureError) {
        setError(captureError instanceof Error ? captureError.message : 'PayPal capture failed.');
      }
    })();
  }, [paypalOrderId]);

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="mx-auto max-w-xl">
        <CardContent className="p-8 text-center">
          {!receipt && !displayError && (
            <>
              <Loader2 className="mx-auto h-12 w-12 animate-spin text-blue-600" />
              <h1 className="mt-4 text-xl font-semibold">Verifying PayPal approval</h1>
              <p className="mt-2 text-gray-600">The server is re-checking the order against your confirmed policy before capture.</p>
            </>
          )}
          {receipt && (
            <>
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <h1 className="mt-4 text-2xl font-bold">Payment captured</h1>
              <p className="mt-2 text-gray-600">PayPal confirmed this Sandbox transaction after validation.</p>
              <dl className="mt-6 space-y-2 rounded-lg bg-gray-50 p-4 text-left text-sm">
                <div className="flex justify-between gap-4"><dt>PayPal order</dt><dd className="break-all font-mono">{receipt.paypalOrderId}</dd></div>
                <div className="flex justify-between gap-4"><dt>Capture</dt><dd className="break-all font-mono">{receipt.captureId}</dd></div>
                <div className="flex justify-between"><dt>Amount</dt><dd>{formatCurrency(receipt.amountCents / 100, 'USD')}</dd></div>
              </dl>
              <Link href={`/missions/${receipt.missionId}`} className="mt-6 inline-block">
                <Button variant="outline">Return to mission</Button>
              </Link>
            </>
          )}
          {displayError && (
            <>
              <AlertCircle className="mx-auto h-12 w-12 text-red-600" />
              <h1 className="mt-4 text-2xl font-bold">Payment not confirmed</h1>
              <p className="mt-2 text-red-800">{displayError}</p>
              <p className="mt-2 text-sm text-gray-600">No success is reported unless PayPal confirms a valid capture.</p>
              <Link href="/missions" className="mt-6 inline-block">
                <Button variant="outline">Back to missions</Button>
              </Link>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
