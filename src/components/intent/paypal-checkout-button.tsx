'use client';

import { useEffect, useRef, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button, Card, CardContent } from '@/components/ui';
import type { PolicyEvaluation } from '@/types/policy';

interface PayPalApprovalData {
  orderId: string;
}

interface PayPalPaymentSession {
  start(
    options: { presentationMode: 'auto' },
    order: Promise<{ orderId: string }>,
  ): Promise<void>;
}

interface PayPalSdkInstance {
  findEligibleMethods(options: { currencyCode: string }): Promise<{
    isEligible(method: 'paypal'): boolean;
  }>;
  createPayPalOneTimePaymentSession(options: {
    onApprove(data: PayPalApprovalData): Promise<void>;
    onCancel(): void;
    onError(error: unknown): void;
  }): PayPalPaymentSession;
}

declare global {
  interface Window {
    paypal?: {
      createInstance(options: {
        clientToken: string;
        components: string[];
        pageType: 'checkout';
      }): Promise<PayPalSdkInstance>;
    };
  }
}

interface CaptureReceipt {
  missionId: string;
  paypalOrderId: string;
  captureId: string;
  amountCents: number;
}

export interface CartDriftDemoResult {
  blocked: true;
  captureAttempted: false;
  paypalOrderId: string;
  originalPurchase: {
    productName: string;
    amountCents: number;
    currency: string;
    hasSubscription: boolean;
  };
  originalEvaluation: PolicyEvaluation;
  changedPurchase: {
    productName: string;
    amountCents: number;
    currency: string;
    hasSubscription: boolean;
    subscription: { monthlyPriceCents: number; description: string } | null;
  };
  evaluation: PolicyEvaluation;
}

interface PayPalCheckoutButtonProps {
  missionId: string;
  productId: string;
  currency: string;
  demoDrift?: boolean;
  onComplete(receipt: CaptureReceipt): void;
  onDriftBlocked?(result: CartDriftDemoResult): void;
}

let sdkLoadPromise: Promise<void> | undefined;

function loadPayPalSdk(): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (sdkLoadPromise) return sdkLoadPromise;

  sdkLoadPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.sandbox.paypal.com/web-sdk/v6/core';
    script.async = true;
    script.onload = () => window.paypal
      ? resolve()
      : reject(new Error('PayPal JavaScript SDK v6 loaded without its API.'));
    script.onerror = () => {
      sdkLoadPromise = undefined;
      reject(new Error('PayPal JavaScript SDK v6 could not be loaded.'));
    };
    document.head.appendChild(script);
  });
  return sdkLoadPromise;
}

export function PayPalCheckoutButton({
  missionId,
  productId,
  currency,
  demoDrift = false,
  onComplete,
  onDriftBlocked,
}: PayPalCheckoutButtonProps) {
  const [session, setSession] = useState<PayPalPaymentSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onCompleteRef = useRef(onComplete);
  const onDriftBlockedRef = useRef(onDriftBlocked);
  const demoDriftRef = useRef(demoDrift);

  useEffect(() => {
    onCompleteRef.current = onComplete;
    onDriftBlockedRef.current = onDriftBlocked;
    demoDriftRef.current = demoDrift;
  }, [demoDrift, onComplete, onDriftBlocked]);

  useEffect(() => {
    let active = true;
    async function initialize() {
      try {
        const tokenResponse = await fetch('/api/paypal/client-token', { cache: 'no-store' });
        const tokenData = await tokenResponse.json();
        if (!tokenResponse.ok || typeof tokenData.clientToken !== 'string') {
          throw new Error(tokenData.error || 'PayPal Sandbox is not configured.');
        }

        await loadPayPalSdk();
        if (!window.paypal) throw new Error('PayPal JavaScript SDK v6 is unavailable.');

        const sdk = await window.paypal.createInstance({
          clientToken: tokenData.clientToken,
          components: ['paypal-payments'],
          pageType: 'checkout',
        });
        const eligible = await sdk.findEligibleMethods({ currencyCode: currency });
        if (!eligible.isEligible('paypal')) {
          throw new Error('PayPal checkout is not available for this buyer or currency.');
        }

        const paymentSession = sdk.createPayPalOneTimePaymentSession({
          async onApprove(data) {
            setProcessing(true);
            try {
              const isDemoDrift = demoDriftRef.current;
              const response = await fetch(isDemoDrift ? '/api/demo/simulate-drift' : '/api/checkout/capture', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ orderId: data.orderId }),
              });
              const result = await response.json();
              if (!response.ok || (isDemoDrift ? !result.blocked : !result.success)) {
                throw new Error(result.error || (isDemoDrift
                  ? 'The unauthorized cart modification was not blocked.'
                  : 'PayPal capture was not confirmed.'));
              }
              if (isDemoDrift) {
                onDriftBlockedRef.current?.(result);
              } else {
                onCompleteRef.current({
                  missionId: result.missionId,
                  paypalOrderId: result.paypalOrderId,
                  captureId: result.captureId,
                  amountCents: result.amountCents,
                });
              }
            } catch (captureError) {
              setError(captureError instanceof Error
                ? captureError.message
                : demoDriftRef.current ? 'Cart-drift demonstration failed.' : 'PayPal capture failed.');
            } finally {
              setProcessing(false);
            }
          },
          onCancel() {
            setProcessing(false);
            setError('PayPal approval was canceled. No payment was captured.');
          },
          onError(paymentError) {
            setProcessing(false);
            setError(paymentError instanceof Error ? paymentError.message : 'PayPal checkout failed.');
          },
        });
        if (active) setSession(paymentSession);
      } catch (initializationError) {
        if (active) {
          setError(initializationError instanceof Error ? initializationError.message : 'PayPal checkout could not be initialized.');
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    void initialize();
    return () => { active = false; };
  }, [currency]);

  const startCheckout = async () => {
    if (!session) return;
    setError(null);
    setProcessing(true);
    try {
      await session.start({ presentationMode: 'auto' }, (async () => {
        const response = await fetch('/api/checkout/create', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ missionId, productId }),
        });
        const result = await response.json();
        if (!response.ok || typeof result.paypalOrderId !== 'string') {
          throw new Error(result.error || 'PayPal order creation failed.');
        }
        return { orderId: result.paypalOrderId };
      })());
    } catch (checkoutError) {
      setError(checkoutError instanceof Error ? checkoutError.message : 'PayPal checkout failed.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="space-y-3">
      <Button onClick={startCheckout} disabled={loading || processing || !session} className="w-full" size="lg">
        {loading || processing ? (
          <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{loading ? 'Loading PayPal…' : 'Waiting for PayPal…'}</>
        ) : demoDrift ? 'Run cart-drift demo (no capture)' : 'Pay with PayPal'}
      </Button>
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="flex items-start gap-2 p-3 text-sm text-red-800">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
