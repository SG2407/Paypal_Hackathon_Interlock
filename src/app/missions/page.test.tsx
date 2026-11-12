import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import MissionsPage from './page';

describe('missions list', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the saved budget in dollars and the product category', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        missions: [{
          id: 'mission-1',
          intent: 'Sony or Bose headphones under $350',
          status: 'active',
          policy: { maxBudgetCents: 35000, currency: 'USD', productCategory: 'headphones' },
          createdAt: '2026-11-11T12:00:00Z',
        }],
      }),
    }));
    render(<MissionsPage />);
    expect(await screen.findByText('Budget: $350.00')).toBeInTheDocument();
    expect(screen.getByText('Category: headphones')).toBeInTheDocument();
  });
});
