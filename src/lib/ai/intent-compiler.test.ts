import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { compileIntent } from './intent-compiler';

const { createCompletion } = vi.hoisted(() => ({ createCompletion: vi.fn() }));

vi.mock('./client', () => ({
  getOpenRouterClient: () => ({ chat: { completions: { create: createCompletion } } }),
  getOpenRouterModel: () => 'test/model',
}));

function response(value: unknown) {
  return { choices: [{ message: { content: JSON.stringify(value) } }] };
}

const completePolicy = {
  productCategory: 'headphones',
  requiredBrand: 'Sony',
  allowedCondition: 'new',
  maxBudgetCents: 20000,
  deliveryDeadline: null,
};

describe('OpenRouter intent compilation', () => {
  beforeEach(() => {
    createCompletion.mockReset();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('discards partial policies when the model asks for clarification', async () => {
    createCompletion.mockResolvedValueOnce(response({
      success: false,
      policy: { phone: { budget: 1300 }, headphones: { budget: 500 } },
      clarificationQuestions: ['Which single product should this mission cover?'],
      rawInterpretation: 'Multiple products were requested.',
    }));

    const result = await compileIntent({ prompt: 'Buy a phone and headphones' });

    expect(result.success).toBe(false);
    expect(result.policy).toBeNull();
    expect(result.clarificationQuestions).toEqual(['Which single product should this mission cover?']);
    expect(createCompletion).toHaveBeenCalledOnce();
  });

  it('retries an incomplete successful response and accepts a complete policy', async () => {
    createCompletion
      .mockResolvedValueOnce(response({
        success: true,
        policy: { headphones: { budget: 200 } },
        clarificationQuestions: [],
        rawInterpretation: 'Headphones',
      }))
      .mockResolvedValueOnce(response({
        success: true,
        policy: { ...completePolicy, requireHumanApproval: false, approvedProducts: [{ productId: 'x' }] },
        clarificationQuestions: [],
        rawInterpretation: 'Sony headphones under $200',
      }));

    const result = await compileIntent({ prompt: 'Sony headphones under $200' });

    expect(createCompletion).toHaveBeenCalledTimes(2);
    expect(createCompletion.mock.calls[1][0].messages.at(-1).content).toContain('previous response');
    expect(result.policy).toMatchObject({
      ...completePolicy,
      requireHumanApproval: true,
      approvedProducts: [],
    });
  });

  it('fails explicitly after a second malformed response without creating a policy', async () => {
    createCompletion.mockResolvedValue(response({
      success: true,
      policy: { headphones: {} },
      clarificationQuestions: [],
      rawInterpretation: null,
    }));

    await expect(compileIntent({ prompt: 'Buy headphones under $200' }))
      .rejects.toThrow('AI returned an incomplete policy');
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it('retries a clarification response that has no questions', async () => {
    createCompletion
      .mockResolvedValueOnce(response({ success: false, policy: null, clarificationQuestions: [] }))
      .mockResolvedValueOnce(response({
        success: false,
        policy: null,
        clarificationQuestions: ['What is your budget?'],
      }));

    const result = await compileIntent({ prompt: 'Buy headphones' });

    expect(result.policy).toBeNull();
    expect(result.clarificationQuestions).toEqual(['What is your budget?']);
    expect(createCompletion).toHaveBeenCalledTimes(2);
  });

  it('reports provider failures without retrying as a schema error', async () => {
    createCompletion.mockRejectedValueOnce(new Error('Provider unavailable'));

    await expect(compileIntent({ prompt: 'Buy headphones under $200' }))
      .rejects.toThrow('AI service could not process your request');
    expect(createCompletion).toHaveBeenCalledOnce();
  });
});
