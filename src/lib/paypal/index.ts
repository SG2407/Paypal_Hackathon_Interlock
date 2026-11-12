import { createHash } from 'node:crypto';
import { z } from 'zod';
import type { PurchaseSnapshot } from '@/types/product';
import type { PayPalAPIOrder, PayPalAPICapture } from '@/types/paypal';

const PAYPAL_SANDBOX_API = 'https://api-m.sandbox.paypal.com';

const AccessTokenSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
});

const PayPalLinkSchema = z.object({ rel: z.string(), href: z.string().url() });

const PayPalOrderSchema = z.object({
  id: z.string().min(1),
  status: z.string(),
  intent: z.string(),
  purchase_units: z.array(z.object({
    custom_id: z.string().optional(),
    amount: z.object({
      currency_code: z.string(),
      value: z.string(),
      breakdown: z.object({
        item_total: z.object({ currency_code: z.string(), value: z.string() }).optional(),
        shipping: z.object({ currency_code: z.string(), value: z.string() }).optional(),
        tax_total: z.object({ currency_code: z.string(), value: z.string() }).optional(),
      }).optional(),
    }).passthrough(),
    items: z.array(z.object({
      name: z.string(),
      quantity: z.string(),
      unit_amount: z.object({ currency_code: z.string(), value: z.string() }),
      sku: z.string().optional(),
    }).passthrough()).optional(),
  }).passthrough()),
  links: z.array(PayPalLinkSchema).optional(),
  payer: z.object({
    email_address: z.string().optional(),
    payer_id: z.string().optional(),
  }).optional(),
}).passthrough();

const PayPalCaptureResponseSchema = z.object({
  id: z.string(),
  status: z.string(),
  purchase_units: z.array(z.object({
    payments: z.object({
      captures: z.array(z.object({
        id: z.string(),
        status: z.string(),
        amount: z.object({ currency_code: z.string(), value: z.string() }),
        final_capture: z.boolean(),
        create_time: z.string(),
        update_time: z.string(),
      })).optional(),
    }).optional(),
  })),
}).passthrough();

const PayPalCreateOrderSchema = PayPalOrderSchema.extend({ links: z.array(PayPalLinkSchema).default([]) });

let cachedAccessToken: { value: string; expiresAt: number } | undefined;
let cachedBrowserSafeToken: { value: string; expiresAt: number } | undefined;

function assertSandboxConfiguration(): { clientId: string; clientSecret: string } {
  if (process.env.PAYPAL_ENV !== 'sandbox') {
    throw new Error('PayPal checkout is restricted to Sandbox. Set PAYPAL_ENV=sandbox.');
  }
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error('PayPal Sandbox credentials are not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.');
  }
  return { clientId, clientSecret };
}

async function getAccessToken(): Promise<string> {
  const { clientId, clientSecret } = assertSandboxConfiguration();
  if (cachedAccessToken && cachedAccessToken.expiresAt > Date.now() + 30_000) {
    return cachedAccessToken.value;
  }

  const response = await fetch(`${PAYPAL_SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`PayPal Sandbox authentication failed (HTTP ${response.status}).`);
  }

  const token = AccessTokenSchema.parse(await response.json());
  cachedAccessToken = {
    value: token.access_token,
    expiresAt: Date.now() + (token.expires_in ?? 300) * 1000,
  };
  return token.access_token;
}

export async function getBrowserSafeClientToken(): Promise<string> {
  const { clientId, clientSecret } = assertSandboxConfiguration();
  if (cachedBrowserSafeToken && cachedBrowserSafeToken.expiresAt > Date.now() + 30_000) {
    return cachedBrowserSafeToken.value;
  }

  const body = new URLSearchParams({
    grant_type: 'client_credentials',
    response_type: 'client_token',
  });
  const response = await fetch(`${PAYPAL_SANDBOX_API}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body,
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`PayPal Sandbox client-token request failed (HTTP ${response.status}).`);
  }

  const token = AccessTokenSchema.parse(await response.json());
  cachedBrowserSafeToken = {
    value: token.access_token,
    expiresAt: Date.now() + Math.min(token.expires_in ?? 900, 900) * 1000,
  };
  return token.access_token;
}

async function paypalRequest(path: string, init: RequestInit = {}): Promise<Response> {
  const accessToken = await getAccessToken();
  const response = await fetch(`${PAYPAL_SANDBOX_API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
    cache: 'no-store',
  });
  if (!response.ok) {
    throw new Error(`PayPal Sandbox request failed (HTTP ${response.status}).`);
  }
  return response;
}

function money(cents: number) {
  return (cents / 100).toFixed(2);
}

function appBaseUrl(): URL {
  const configuredUrl = process.env.APP_BASE_URL;
  if (!configuredUrl) throw new Error('APP_BASE_URL is not configured.');

  const url = new URL(configuredUrl);
  const localHttp = url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname);
  if ((!localHttp && url.protocol !== 'https:') || url.username || url.password) {
    throw new Error('APP_BASE_URL must use HTTPS, except for localhost development.');
  }
  return url;
}

export async function createSandboxOrder(localOrderId: string, missionId: string, snapshot: PurchaseSnapshot) {
  const baseUrl = appBaseUrl();
  const totalCents = snapshot.totalCents;
  const response = await paypalRequest('/v2/checkout/orders', {
    method: 'POST',
    headers: { 'PayPal-Request-Id': createHash('sha256').update(localOrderId).digest('hex').slice(0, 36) },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: localOrderId,
        invoice_id: localOrderId,
        description: snapshot.productName,
        items: [{
          name: snapshot.productName.slice(0, 127),
          sku: snapshot.productSku.slice(0, 127),
          quantity: String(snapshot.quantity),
          category: 'PHYSICAL_GOODS',
          unit_amount: { currency_code: snapshot.currency, value: money(snapshot.priceCents) },
        }],
        amount: {
          currency_code: snapshot.currency,
          value: money(totalCents),
          breakdown: {
            item_total: { currency_code: snapshot.currency, value: money(snapshot.priceCents * snapshot.quantity) },
            shipping: { currency_code: snapshot.currency, value: money(snapshot.shippingCents * snapshot.quantity) },
            tax_total: { currency_code: snapshot.currency, value: money(snapshot.taxEstimateCents * snapshot.quantity) },
          },
        },
      }],
      payment_source: {
        paypal: {
          experience_context: {
            brand_name: 'IntentLock',
            user_action: 'PAY_NOW',
            return_url: new URL('/checkout/return', baseUrl).toString(),
            cancel_url: new URL(`/checkout/cancel?missionId=${encodeURIComponent(missionId)}`, baseUrl).toString(),
          },
        },
      },
    }),
  });

  const order = PayPalCreateOrderSchema.parse(await response.json());
  const approvalUrl = order.links.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
  if (!approvalUrl) throw new Error('PayPal Sandbox did not provide a buyer approval URL.');
  return { order: order as PayPalAPIOrder, approvalUrl };
}

export async function getSandboxOrder(
  paypalOrderId: string,
): Promise<PayPalAPIOrder & { links?: Array<{ rel: string; href: string }> }> {
  const response = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`);
  return PayPalOrderSchema.parse(await response.json()) as PayPalAPIOrder & { links?: Array<{ rel: string; href: string }> };
}

export function getBuyerReturnUrl(paypalOrderId: string): string {
  const returnUrl = new URL('/checkout/return', appBaseUrl());
  returnUrl.searchParams.set('token', paypalOrderId);
  return returnUrl.toString();
}

export async function captureSandboxOrder(paypalOrderId: string, localOrderId: string): Promise<PayPalAPICapture> {
  const requestId = createHash('sha256').update(`${localOrderId}:capture`).digest('hex').slice(0, 36);
  const response = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    headers: { 'PayPal-Request-Id': requestId },
    body: '{}',
  });
  const captureResponse = PayPalCaptureResponseSchema.parse(await response.json());
  const capture = captureResponse.purchase_units
    .flatMap((unit) => unit.payments?.captures ?? [])
    .find((item) => item.final_capture !== false);
  if (!capture || capture.status !== 'COMPLETED') {
    throw new Error('PayPal Sandbox did not confirm a completed capture.');
  }
  return capture as PayPalAPICapture;
}

export function getApprovalUrl(order: PayPalAPIOrder & { links?: Array<{ rel: string; href: string }> }): string | undefined {
  return order.links?.find((link) => link.rel === 'payer-action' || link.rel === 'approve')?.href;
}

export function getCaptureFromCompletedOrder(order: PayPalAPIOrder): PayPalAPICapture | undefined {
  const parsed = PayPalOrderSchema.passthrough().safeParse(order);
  if (!parsed.success) return undefined;
  const captureResponse = PayPalCaptureResponseSchema.safeParse(parsed.data);
  if (!captureResponse.success) return undefined;
  const capture = captureResponse.data.purchase_units
    .flatMap((unit) => unit.payments?.captures ?? [])
    .find((item) => item.status === 'COMPLETED');
  return capture as PayPalAPICapture | undefined;
}
