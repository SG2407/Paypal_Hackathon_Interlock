import { APIError } from 'openai';

export function openRouterRequestError(error: unknown): Error {
  if (!(error instanceof APIError)) {
    console.error('OpenRouter request failed with an unexpected error.');
    return new Error('The AI service could not process your request due to an unexpected error. Check the server logs and try again.');
  }

  const status = error.status;
  console.error('OpenRouter request failed:', status === undefined ? 'connection error' : `HTTP ${status}`);

  if (status === undefined) {
    return new Error('Could not connect to OpenRouter. Check your internet connection and try again.');
  }

  const prefix = `OpenRouter returned HTTP ${status}.`;
  switch (status) {
    case 400:
      return new Error(`${prefix} Check that OPENROUTER_MODEL supports the requested JSON output.`);
    case 401:
      return new Error(`${prefix} Check that OPENROUTER_API_KEY is valid and restart the server after changing it.`);
    case 402:
      return new Error(`${prefix} Check your OpenRouter credits and account limits.`);
    case 403:
      return new Error(`${prefix} Check your OpenRouter account and model permissions.`);
    case 404:
      return new Error(`${prefix} Check that OPENROUTER_MODEL is a valid, available model.`);
    case 429:
      return new Error(`${prefix} The service is rate-limiting requests. Wait and try again.`);
    default:
      return new Error(status >= 500
        ? `${prefix} The AI service or model provider may be unavailable. Try again later.`
        : `${prefix} Check your OpenRouter configuration and account.`);
  }
}
