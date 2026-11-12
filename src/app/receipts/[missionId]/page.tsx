'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CheckCircle, Loader2, ShieldCheck, ShieldAlert } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '@/components/ui';
import { formatCurrency } from '@/lib/utils';
import type { IntentReceipt } from '@/types/audit';

export default function ReceiptPage({ params }: { params: Promise<{ missionId: string }> }) {
  const { missionId } = use(params);
  const [receipt, setReceipt] = useState<IntentReceipt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function loadReceipt() {
      try {
        const response = await fetch(`/api/receipts/${encodeURIComponent(missionId)}`, { cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not load the transaction receipt');
        if (active) setReceipt(data);
      } catch (loadError) {
        if (active) setError(loadError instanceof Error ? loadError.message : 'Could not load the transaction receipt');
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadReceipt();
    return () => { active = false; };
  }, [missionId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!receipt) {
    return (
      <div className="container mx-auto max-w-3xl px-4 py-10">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-red-800">{error || 'Transaction receipt not found'}</CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl space-y-6 px-4 py-8">
      <Link href={`/missions/${encodeURIComponent(missionId)}`} className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
        <ArrowLeft className="mr-1 h-4 w-4" />
        Back to mission
      </Link>

      <Card className="border-green-200 bg-green-50">
        <CardContent className="flex items-start gap-4 p-6">
          <CheckCircle className="mt-1 h-8 w-8 shrink-0 text-green-600" />
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-green-950">Intent Receipt</h1>
            <p className="mt-1 text-green-800">
              PayPal Sandbox capture verified against buyer permission version {receipt.policyVersion}.
            </p>
            <dl className="mt-4 grid gap-2 text-sm sm:grid-cols-2">
              <div><dt className="text-green-800">PayPal order</dt><dd className="break-all font-mono">{receipt.paypalOrderId}</dd></div>
              <div><dt className="text-green-800">PayPal capture</dt><dd className="break-all font-mono">{receipt.paypalCaptureId}</dd></div>
              <div><dt className="text-green-800">Status</dt><dd>{receipt.transactionStatus}</dd></div>
              <div><dt className="text-green-800">Captured</dt><dd>{new Date(receipt.capturedAt).toLocaleString()}</dd></div>
            </dl>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Original buyer request</CardTitle></CardHeader>
        <CardContent>
          <p className="text-gray-700">&ldquo;{receipt.originalPrompt}&rdquo;</p>
          <p className="mt-3 text-xs text-gray-500">Mission {receipt.missionId} · Buyer approved at {new Date(receipt.buyerApprovedAt).toLocaleString()}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Authorized purchase</CardTitle></CardHeader>
        <CardContent>
          <h2 className="font-semibold text-gray-900">{receipt.product.name}</h2>
          <p className="text-sm text-gray-500">{receipt.product.brand} · SKU {receipt.product.sku}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between"><dt>Product</dt><dd>{formatCurrency(receipt.product.priceCents / 100, receipt.product.currency)}</dd></div>
            <div className="flex justify-between"><dt>Shipping</dt><dd>{formatCurrency(receipt.product.shippingCents / 100, receipt.product.currency)}</dd></div>
            <div className="flex justify-between"><dt>Estimated tax</dt><dd>{formatCurrency(receipt.product.taxEstimateCents / 100, receipt.product.currency)}</dd></div>
            <div className="flex justify-between border-t pt-2 font-semibold"><dt>Authorized total</dt><dd>{formatCurrency(receipt.product.totalCents / 100, receipt.product.currency)}</dd></div>
          </dl>
          {receipt.aiRecommendationExplanation && (
            <p className="mt-4 rounded-lg bg-blue-50 p-3 text-sm text-blue-900">
              Recommendation: {receipt.aiRecommendationExplanation}
            </p>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Confirmed policy · version {receipt.policyVersion}</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
            {JSON.stringify(receipt.confirmedPolicy, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Pre-capture validation</CardTitle></CardHeader>
        <CardContent>
          <pre className="overflow-x-auto rounded-lg bg-gray-950 p-4 text-xs text-gray-100">
            {JSON.stringify(receipt.policyValidationResults, null, 2)}
          </pre>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2">
          {receipt.auditVerification.valid
            ? <ShieldCheck className="h-5 w-5 text-green-600" />
            : <ShieldAlert className="h-5 w-5 text-red-600" />}
          <CardTitle>Hash-chained audit trail</CardTitle>
        </CardHeader>
        <CardContent>
          <p className={`mb-4 text-sm ${receipt.auditVerification.valid ? 'text-green-700' : 'text-red-700'}`}>
            {receipt.auditVerification.valid ? 'Verified' : 'Verification failed'}: {receipt.auditVerification.details}
          </p>
          <ol className="space-y-3">
            {receipt.auditTimeline.map((event) => (
              <li key={event.id} className="border-l-2 border-blue-200 pl-4">
                <p className="font-medium text-gray-900">{event.eventType.replaceAll('_', ' ')}</p>
                <p className="text-xs text-gray-500">{new Date(event.createdAt).toLocaleString()}</p>
                <p className="break-all font-mono text-xs text-gray-500">Hash {event.eventHash}</p>
              </li>
            ))}
          </ol>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Link href="/history"><Button variant="outline">Full audit history</Button></Link>
        <Link href="/missions"><Button>View missions</Button></Link>
      </div>
    </div>
  );
}
