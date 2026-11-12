import OpenAI from 'openai';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export function getOpenRouterModel(): string {
  return process.env.OPENROUTER_MODEL || 'openrouter/free';
}

export function getOpenRouterClient(): OpenAI {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error('OPENROUTER_API_KEY environment variable is not set');
  }

  return new OpenAI({
    apiKey,
    baseURL: OPENROUTER_BASE_URL,
    defaultHeaders: {
      'HTTP-Referer': process.env.APP_BASE_URL || 'http://localhost:3000',
      'X-OpenRouter-Title': 'IntentLock',
    },
  });
}
