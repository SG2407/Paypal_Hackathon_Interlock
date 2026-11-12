import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileIntentMock } from '@/lib/ai/intent-compiler';
import MissionDetailPage from './page';

describe('mission recommendations', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('displays recommendation failures instead of an endless loading message', async () => {
    const policy = compileIntentMock('Headphones under $200').policy;
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ mission: {
          id: 'mission-1',
          intent: 'Headphones under $200',
          status: 'active',
          policy,
          createdAt: '2026-11-11T12:00:00Z',
        } }),
      })
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: 'OpenRouter returned HTTP 429. Try again later.' }),
      }));

    await act(async () => {
      render(<MissionDetailPage params={Promise.resolve({ id: 'mission-1' })} />);
    });

    expect(await screen.findByText('OpenRouter returned HTTP 429. Try again later.')).toBeInTheDocument();
    expect(screen.getByText('Recommendations could not be loaded.')).toBeInTheDocument();
    expect(screen.queryByText('Loading recommendations...')).not.toBeInTheDocument();
  });

  it('shows a concise policy result for each product and the allowed brands', async () => {
    const policy = {
      ...compileIntentMock('Headphones under $200').policy!,
      requiredBrand: null,
      allowedBrands: ['Sony', 'Bose'],
    };
    const product = {
      id: 'one',
      sku: 'sku',
      name: 'Sony headphones',
      brand: 'Sony',
      description: 'Headphones',
      category: 'headphones',
      color: null,
      condition: 'new',
      priceCents: 15000,
      shippingCents: 0,
      taxEstimateCents: 0,
      currency: 'USD',
      deliveryDate: '2026-11-15',
      merchantId: 'store',
      merchantName: 'Store',
      imageUrl: null,
      attributes: {},
      hasSubscription: false,
      subscriptionInfo: null,
    };
    const passingCheck = {
      checkName: 'budget',
      decision: 'PASS',
      explanation: 'A verbose passing check',
      expected: null,
      actual: null,
    };
    const blockingCheck = {
      checkName: 'allowed_brands',
      decision: 'BLOCK',
      explanation: 'Apple is not an allowed brand',
      expected: 'Sony or Bose',
      actual: 'Apple',
    };
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ mission: { id: 'mission-1', intent: 'Headphones', status: 'active', policy } }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ recommendations: [
          { product, aiRank: 1, evaluation: { decision: 'PASS', checks: [passingCheck], warnings: [], violations: [] } },
          {
            product: { ...product, id: 'two', name: 'Apple headphones', brand: 'Apple' },
            aiRank: 2,
            evaluation: { decision: 'BLOCK', checks: [passingCheck, blockingCheck], warnings: [], violations: [blockingCheck] },
          },
        ] }),
      }));

    await act(async () => {
      render(<MissionDetailPage params={Promise.resolve({ id: 'mission-1' })} />);
    });

    expect(await screen.findByText('Allowed brands: Sony or Bose')).toBeInTheDocument();
    expect(screen.getByText('Meets the confirmed purchase policy.')).toBeInTheDocument();
    expect(screen.getByText('Apple is not an allowed brand')).toBeInTheDocument();
    expect(screen.queryByText('A verbose passing check')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Select for checkout' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Checkout unavailable' })).toBeDisabled();
  });
});
