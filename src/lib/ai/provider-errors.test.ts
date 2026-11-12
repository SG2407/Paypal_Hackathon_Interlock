import { APIConnectionError, APIError } from 'openai';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { openRouterRequestError } from './provider-errors';

describe('OpenRouter error reporting', () => {
  afterEach(() => vi.restoreAllMocks());

  it.each([
    [400, 'JSON output'],
    [401, 'OPENROUTER_API_KEY'],
    [402, 'credits'],
    [403, 'permissions'],
    [404, 'OPENROUTER_MODEL'],
    [429, 'rate-limiting'],
    [503, 'unavailable'],
    [418, 'configuration'],
  ])('reports HTTP %i with relevant guidance', (status, guidance) => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new APIError(status, { token: 'secret' }, 'secret', undefined);
    const message = openRouterRequestError(error).message;

    expect(message).toContain(`HTTP ${status}`);
    expect(message).toContain(guidance);
    expect(message).not.toContain('secret');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });

  it('distinguishes connection failures without leaking the underlying error', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    const error = new APIConnectionError({ message: 'secret' });

    expect(openRouterRequestError(error).message).toContain('Could not connect');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });

  it('reports unexpected failures without exposing their message', () => {
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(openRouterRequestError(new Error('secret')).message).toContain('unexpected error');
    expect(JSON.stringify(log.mock.calls)).not.toContain('secret');
  });
});
