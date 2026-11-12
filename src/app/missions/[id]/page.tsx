'use client';

import { useState, useEffect, use } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, ShoppingCart, CreditCard, AlertCircle, CheckCircle } from 'lucide-react';
import { Button, Card, CardHeader, CardTitle, CardContent, Badge } from '@/components/ui';
import {
  PolicyDisplay,
  ProductCard,
  ValidationResultDisplay,
  PayPalCheckoutButton,
  type CartDriftDemoResult,
} from '@/components/intent';
import { formatCurrency } from '@/lib/utils';
import type { PermissionPolicy, PolicyEvaluation } from '@/types/policy';
import type { Product } from '@/types/product';

interface Mission {
  id: string;
  intent: string;
  status: 'pending' | 'active' | 'completed' | 'cancelled';
  policy: PermissionPolicy;
  createdAt: string;
  selectedProductId?: string;
}

interface ProductRecommendation {
  product: Product;
  aiRank: number | null;
  aiExplanation: string;
  evaluation: PolicyEvaluation;
}

interface CaptureReceipt {
  missionId: string;
  paypalOrderId: string;
  captureId: string;
  amountCents: number;
}

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [mission, setMission] = useState<Mission | null>(null);
  const [recommendations, setRecommendations] = useState<ProductRecommendation[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [validationResult, setValidationResult] = useState<PolicyEvaluation | null>(null);
  const [captureReceipt, setCaptureReceipt] = useState<CaptureReceipt | null>(null);
  const [driftDemoResult, setDriftDemoResult] = useState<CartDriftDemoResult | null>(null);
  const [approvingException, setApprovingException] = useState(false);

  useEffect(() => {
    const fetchMission = async () => {
      try {
        const response = await fetch(`/api/missions/${id}`);
        if (!response.ok) {
          throw new Error('Mission not found');
        }
        const data = await response.json();
        setMission(data.mission);

        // Fetch product recommendations
        const recsResponse = await fetch(`/api/missions/${id}/recommendations`);
        const recsData = await recsResponse.json();
        if (!recsResponse.ok) {
          throw new Error(recsData.error || 'Failed to load recommendations');
        }
        setRecommendations(recsData.recommendations || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load mission');
      } finally {
        setLoading(false);
      }
    };

    fetchMission();
  }, [id]);

  const handleProductSelect = async (recommendation: ProductRecommendation) => {
    if (!mission) return;
    const { product } = recommendation;
    setError(null);
    setSelectedProduct(product);
    setValidationResult(null);
    setDriftDemoResult(null);

    try {
      const response = await fetch('/api/policy/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          missionId: mission.id,
          productId: product.id,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Policy validation failed');
      }
      setValidationResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Policy validation failed');
    }
  };

  const handleApproveProductException = async () => {
    if (!mission || !selectedProduct || validationResult?.decision !== 'REVIEW') return;
    setApprovingException(true);
    setError(null);
    try {
      const response = await fetch('/api/policy/approve-product', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ missionId: mission.id, productId: selectedProduct.id }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not confirm the product exception');

      setMission({ ...mission, policy: data.policy });
      setValidationResult(data.evaluation);
      setRecommendations((current) => current.map((recommendation) =>
        recommendation.product.id === selectedProduct.id
          ? { ...recommendation, evaluation: data.evaluation }
          : recommendation
      ));
    } catch (exceptionError) {
      setError(exceptionError instanceof Error ? exceptionError.message : 'Could not confirm the product exception');
    } finally {
      setApprovingException(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (!mission) {
    return (
      <div className="container mx-auto px-4 py-8">
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-6 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-red-500" />
            <h2 className="mt-4 text-lg font-medium text-red-900">{error || 'Mission not found'}</h2>
            <Link href="/missions" className="mt-4 inline-block">
              <Button variant="outline">Back to Missions</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (captureReceipt) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="mx-auto max-w-xl">
          <CardContent className="p-8 text-center">
            <CheckCircle className="mx-auto h-14 w-14 text-green-600" />
            <h1 className="mt-4 text-2xl font-bold text-gray-900">PayPal Sandbox purchase captured</h1>
            <p className="mt-2 text-gray-600">The payment was confirmed by PayPal after policy and order validation.</p>
            <dl className="mt-6 space-y-2 rounded-lg bg-gray-50 p-4 text-left text-sm">
              <div className="flex justify-between gap-4"><dt>PayPal order</dt><dd className="break-all font-mono">{captureReceipt.paypalOrderId}</dd></div>
              <div className="flex justify-between gap-4"><dt>Capture</dt><dd className="break-all font-mono">{captureReceipt.captureId}</dd></div>
              <div className="flex justify-between"><dt>Amount</dt><dd>{formatCurrency(captureReceipt.amountCents / 100, selectedProduct?.currency ?? 'USD')}</dd></div>
            </dl>
            <div className="mt-6 flex justify-center gap-3">
              <Link href={`/receipts/${encodeURIComponent(captureReceipt.missionId)}`}>
                <Button>View Intent Receipt</Button>
              </Link>
              <Link href="/history">
                <Button variant="outline">Audit history</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="mb-8">
        <Link href="/missions" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ArrowLeft className="mr-1 h-4 w-4" />
          Back to Missions
        </Link>
        <div className="mt-4 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Shopping Mission</h1>
            <p className="mt-1 text-gray-500">&ldquo;{mission.intent}&rdquo;</p>
          </div>
          <Badge variant={mission.status === 'active' ? 'info' : 'default'} className="text-sm">
            {mission.status}
          </Badge>
        </div>
      </div>

      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4 text-sm text-red-800">{error}</CardContent>
        </Card>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left Column - Products */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-blue-600" />
                Recommended Products
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recommendations.length === 0 ? (
                <div className="py-8 text-center text-gray-500">
                  <ShoppingCart className="mx-auto h-12 w-12 text-gray-400" />
                  <p className="mt-2">{error ? 'Recommendations could not be loaded.' : 'No recommendations available.'}</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {recommendations.map((rec) => (
                    <ProductCard
                      key={rec.product.id}
                      product={rec.product}
                      decision={rec.evaluation.decision}
                      explanation={rec.evaluation.decision === 'PASS'
                        ? 'Meets the confirmed purchase policy.'
                        : [...rec.evaluation.violations, ...rec.evaluation.warnings].map((check) => check.explanation).join(' ')}
                      aiExplanation={rec.aiExplanation}
                      selected={selectedProduct?.id === rec.product.id}
                      onSelect={() => handleProductSelect(rec)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Validation Result */}
          {validationResult && (
            <ValidationResultDisplay result={validationResult} />
          )}
        </div>

        {/* Right Column - Policy & Checkout */}
        <div className="space-y-6">
          <PolicyDisplay policy={mission.policy} />

          {/* Checkout Card */}
          {selectedProduct && validationResult && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5 text-blue-600" />
                  Checkout
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="text-sm text-gray-500">Selected Product</p>
                  <p className="font-medium text-gray-900">{selectedProduct.name}</p>
                  <p className="text-lg font-bold text-blue-600">
                    {formatCurrency(selectedProduct.priceCents / 100, selectedProduct.currency)}
                  </p>
                </div>

                {validationResult.decision === 'PASS' ? (
                  <>
                    <PayPalCheckoutButton
                      missionId={mission.id}
                      productId={selectedProduct.id}
                      currency={selectedProduct.currency}
                      onComplete={(receipt) => {
                        setCaptureReceipt(receipt);
                        setMission((current) => current ? { ...current, status: 'completed' } : current);
                      }}
                    />
                    {process.env.NEXT_PUBLIC_INTENTLOCK_DEMO_MODE === 'true' && (
                      <div className="border-t pt-4">
                        <p className="mb-3 text-xs text-amber-800">
                          Sandbox test only: this separate buyer-approved order simulates an unauthorized recurring add-on. It is always blocked and never captured.
                        </p>
                        <PayPalCheckoutButton
                          missionId={mission.id}
                          productId={selectedProduct.id}
                          currency={selectedProduct.currency}
                          demoDrift
                          onComplete={() => undefined}
                          onDriftBlocked={setDriftDemoResult}
                        />
                      </div>
                    )}
                  </>
                ) : validationResult.decision === 'REVIEW' ? (
                  <div className="space-y-3">
                    <p className="text-sm text-yellow-700 bg-yellow-50 p-3 rounded-lg">
                      Review the warnings before continuing. This adds a versioned exception for this product only; mandatory BLOCK checks can never be overridden.
                    </p>
                    <Button
                      onClick={handleApproveProductException}
                      disabled={approvingException}
                      variant="outline"
                      className="w-full"
                    >
                      {approvingException ? 'Saving buyer confirmation…' : 'Confirm this product exception'}
                    </Button>
                  </div>
                ) : (
                  <div className="text-sm text-red-700 bg-red-50 p-3 rounded-lg">
                    This product violates your policy and cannot be purchased.
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {driftDemoResult && (
            <Card className="border-red-300 bg-red-50">
              <CardHeader>
                <CardTitle className="text-red-900">Cart-tampering demo: BLOCKED</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <p className="text-red-800">
                  The approved PayPal Sandbox order was not captured. The actual PayPal response was left unchanged.
                </p>
                <div className="rounded-lg bg-white p-3">
                  <p className="font-semibold">Original buyer-authorized purchase</p>
                  <p>{driftDemoResult.originalPurchase.productName}</p>
                  <p>
                    {formatCurrency(
                      driftDemoResult.originalPurchase.amountCents / 100,
                      driftDemoResult.originalPurchase.currency,
                    )} · no subscription
                  </p>
                  <p className="mt-1 text-green-700">
                    Original order validation: {driftDemoResult.originalEvaluation.decision}
                  </p>
                </div>
                <div className="rounded-lg border border-red-200 bg-white p-3">
                  <p className="font-semibold">Simulated changed cart</p>
                  <p>{driftDemoResult.changedPurchase.productName}</p>
                  <p>
                    Added: {driftDemoResult.changedPurchase.subscription?.description} —{' '}
                    {formatCurrency(
                      (driftDemoResult.changedPurchase.subscription?.monthlyPriceCents ?? 0) / 100,
                      driftDemoResult.changedPurchase.currency,
                    )}/month
                  </p>
                </div>
                <div>
                  <p className="font-semibold">Detected policy violations</p>
                  <ul className="mt-1 list-disc space-y-1 pl-5 text-red-800">
                    {driftDemoResult.evaluation.violations.map((violation, index) => (
                      <li key={`${violation.checkName}-${index}`}>{violation.explanation}</li>
                    ))}
                  </ul>
                </div>
                <p className="break-all font-mono text-xs text-gray-600">
                  PayPal Sandbox order: {driftDemoResult.paypalOrderId}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
