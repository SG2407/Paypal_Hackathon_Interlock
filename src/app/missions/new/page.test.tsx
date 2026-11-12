import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import NewMissionPage from './page';

vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

describe('mission clarification', () => {
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('requires answers to the current questions while preserving earlier answers', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          policy: null,
          clarificationQuestions: ['Which product?'],
          rawInterpretation: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: false,
          policy: null,
          clarificationQuestions: ['What is your budget?'],
          rawInterpretation: null,
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          success: true,
          policy: {
            productCategory: 'headphones',
            requiredBrand: 'Sony',
            requiredAttributes: [],
            allowedCondition: 'new',
            maxBudgetCents: 20000,
            currency: 'USD',
            budgetIncludesShipping: true,
            budgetIncludesTax: true,
            deliveryDeadline: null,
            minQuantity: 1,
            maxQuantity: 1,
            allowSubscriptions: false,
            allowAddOns: false,
            allowSubstitutions: false,
            allowedMerchants: null,
            blockedMerchants: [],
            requireHumanApproval: true,
            approvedProducts: [],
            expiresAt: null,
            clarificationNeeded: [],
          },
          clarificationQuestions: [],
          rawInterpretation: null,
        }),
      });
    vi.stubGlobal('fetch', fetchMock);
    render(<NewMissionPage />);

    fireEvent.change(screen.getByPlaceholderText(/describe what you want/i), {
      target: { value: 'I want a phone and headphones' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create shopping mission/i }));

    const firstAnswer = await screen.findByRole('textbox', { name: 'Which product?' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(firstAnswer, { target: { value: 'Sony headphones' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const secondAnswer = await screen.findByRole('textbox', { name: 'What is your budget?' });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(secondAnswer, { target: { value: '  ' } });
    expect(screen.getByRole('button', { name: 'Continue' })).toBeDisabled();
    fireEvent.change(secondAnswer, { target: { value: '$200' } });
    fireEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await waitFor(() => expect(screen.getByRole('button', { name: /confirm & find products/i })).toBeInTheDocument());
    const lastRequest = JSON.parse(fetchMock.mock.calls[2][1].body);
    expect(lastRequest.intent).toBe('I want a phone and headphones');
    expect(lastRequest.clarifications).toContain('Which product?: Sony headphones');
    expect(lastRequest.clarifications).toContain('What is your budget?: $200');
  });
});
