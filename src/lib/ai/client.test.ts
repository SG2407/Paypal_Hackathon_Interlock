import { afterEach, describe, expect, it, vi } from 'vitest';
import { getOpenRouterModel } from './client';

describe('OpenRouter model configuration', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('uses the free router when no model is configured', () => {
    vi.stubEnv('OPENROUTER_MODEL', undefined);
    expect(getOpenRouterModel()).toBe('openrouter/free');
  });

  it('uses the free router when the model is blank', () => {
    vi.stubEnv('OPENROUTER_MODEL', '');
    expect(getOpenRouterModel()).toBe('openrouter/free');
  });

  it('respects an explicitly configured model', () => {
    vi.stubEnv('OPENROUTER_MODEL', 'example/model:free');
    expect(getOpenRouterModel()).toBe('example/model:free');
  });
});
