import { NextRequest } from 'next/server';
import { APIError } from 'openai';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POST } from './route';

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock('@/lib/ai/client', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: createCompletion } } }),
  getOpenRouterModel: () => 'test/model',
}));

function request(body: object) {
  return new NextRequest('http://localhost:3000/api/intent/compile', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}

function completion(value: unknown) {
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}

describe('intent compilation API', () => {
  beforeEach(() => {
    vi.stubEnv('OPENROUTER_API_KEY', 'test-key');
    createCompletion.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('returns a clarification rather than rejecting a partial policy', async () => {
    createCompletion.mockResolvedValueOnce(completion({
      success: false,
      policy: { phone: {}, headphones: {} },
      clarificationQuestions: ['Which product should this mission cover?'],
    }));

    const response = await POST(request({ intent: 'Buy a phone and headphones' }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: false,
      policy: null,
      clarificationQuestions: ['Which product should this mission cover?'],
    });
  });

  it('forwards clarification answers to the compiler', async () => {
    createCompletion.mockResolvedValueOnce(completion({
      success: true,
      policy: {
        productCategory: 'headphones',
        requiredBrand: 'Sony',
        allowedCondition: 'new',
        maxBudgetCents: 20000,
        deliveryDeadline: null,
      },
      clarificationQuestions: [],
    }));

    const response = await POST(request({
      intent: 'Buy a phone and headphones',
      clarifications: 'Which product?: Sony headphones, budget $200',
    }));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      success: true,
      policy: { productCategory: 'headphones', maxBudgetCents: 20000 },
    });
    expect(createCompletion.mock.calls[0][0].messages[1].content)
      .toContain('Which product?: Sony headphones, budget $200');
  });

  it('returns a clear error if both model responses are incomplete', async () => {
    createCompletion.mockResolvedValue(completion({
      success: true,
      policy: { headphones: {} },
      clarificationQuestions: [],
    }));

    const response = await POST(request({ intent: 'Buy headphones under $200' }));

    expect(response.status).toBe(502);
    expect(await response.json()).toEqual({
      error: 'The AI returned an incomplete policy. Please try again with one product and its budget per mission.',
    });
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it('surfaces a sanitized provider status and actionable guidance', async () => {
    createCompletion.mockRejectedValueOnce(new APIError(
      402,
      { message: 'Sensitive provider details' },
      'Sensitive provider details',
      undefined,
    ));

    const response = await POST(request({ intent: 'Buy headphones under $200' }));
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toContain('OpenRouter returned HTTP 402');
    expect(body.error).toContain('credits');
    expect(body.error).not.toContain('Sensitive provider details');
  });
});
