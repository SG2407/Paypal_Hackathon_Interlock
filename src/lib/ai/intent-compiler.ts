import OpenAI from 'openai';
import {
  IntentCompilationResponse,
  IntentCompilationResponseSchema,
  PermissionPolicy,
} from '@/types/policy';
import { INTENT_COMPILER_SYSTEM_PROMPT } from './prompts';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

// Default policy values for safe fallback
function getDefaultPolicy(): Partial<PermissionPolicy> {
  return {
    currency: 'USD',
    budgetIncludesShipping: true,
    budgetIncludesTax: true,
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
    requiredAttributes: [],
  };
}

interface CompileIntentOptions {
  prompt: string;
  currentDate?: Date;
}

/**
 * Compiles a natural language shopping intent into a structured permission policy.
 * Uses OpenAI GPT-4o to understand the intent and extract constraints.
 */
export async function compileIntent(
  options: CompileIntentOptions
): Promise<IntentCompilationResponse> {
  const { prompt, currentDate = new Date() } = options;

  // Validate input
  if (!prompt || prompt.trim().length < 5) {
    return {
      success: false,
      policy: null,
      clarificationQuestions: ['Please provide a more detailed shopping request'],
      rawInterpretation: 'Input prompt is too short or empty',
    };
  }

  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Prepare the system prompt with today's date
    const systemPrompt = INTENT_COMPILER_SYSTEM_PROMPT.replace(
      '{{TODAY_DATE}}',
      currentDate.toISOString().split('T')[0]
    );

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Shopping request: "${prompt}"` },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.2, // Low temperature for consistent, structured output
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    // Parse the JSON response
    const parsed = JSON.parse(content);

    // Validate with Zod schema
    const validated = IntentCompilationResponseSchema.parse({
      success: parsed.success ?? false,
      policy: parsed.policy ? {
        ...getDefaultPolicy(),
        ...parsed.policy,
        requireHumanApproval: true,
        approvedProducts: [],
      } : null,
      clarificationQuestions: parsed.clarificationQuestions ?? [],
      rawInterpretation: parsed.rawInterpretation ?? null,
    });

    return validated;
  } catch (error) {
    console.error('Intent compilation error:', error);
    throw new Error('Intent compilation failed. Verify the OpenAI API configuration and retry.');
  }
}

/**
 * Mock implementation for testing without API calls.
 * Parses simple patterns from the prompt.
 */
export function compileIntentMock(prompt: string): IntentCompilationResponse {
  const lowerPrompt = prompt.toLowerCase();

  // Extract category patterns
  let category = 'electronics';
  if (lowerPrompt.includes('headphone')) category = 'headphones';
  else if (lowerPrompt.includes('laptop')) category = 'laptop';
  else if (lowerPrompt.includes('phone')) category = 'phone';
  else if (lowerPrompt.includes('camera')) category = 'camera';
  else if (lowerPrompt.includes('tablet')) category = 'tablet';

  // Extract brand
  let brand: string | null = null;
  const brands = ['sony', 'apple', 'samsung', 'bose', 'dell', 'hp', 'lenovo'];
  for (const b of brands) {
    if (lowerPrompt.includes(b)) {
      brand = b.charAt(0).toUpperCase() + b.slice(1);
      break;
    }
  }

  // Extract budget
  const budgetMatch = prompt.match(/\$(\d+(?:,\d{3})*(?:\.\d{2})?)/);
  const maxBudgetCents = budgetMatch
    ? Math.round(parseFloat(budgetMatch[1].replace(',', '')) * 100)
    : 50000; // Default $500

  // Extract condition
  let condition: 'new' | 'refurbished' | 'used' | 'any' = 'new';
  if (lowerPrompt.includes('refurbished')) condition = 'refurbished';
  else if (lowerPrompt.includes('used')) condition = 'used';
  else if (lowerPrompt.includes('any condition')) condition = 'any';

  // Extract delivery deadline
  let deliveryDeadline: string | null = null;
  if (lowerPrompt.includes('tomorrow')) {
    deliveryDeadline = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  } else if (lowerPrompt.includes('next week') || lowerPrompt.includes('within a week')) {
    deliveryDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  } else if (lowerPrompt.includes('asap') || lowerPrompt.includes('urgent')) {
    deliveryDeadline = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString();
  }

  // Extract attributes
  const requiredAttributes: { attribute: string; value: string; required: boolean }[] = [];
  if (lowerPrompt.includes('noise-cancelling') || lowerPrompt.includes('noise cancelling')) {
    requiredAttributes.push({ attribute: 'noiseCancelling', value: 'yes', required: true });
  }
  if (lowerPrompt.includes('wireless')) {
    requiredAttributes.push({ attribute: 'wireless', value: 'yes', required: true });
  }

  // Check for subscriptions
  const allowSubscriptions = lowerPrompt.includes('subscription') && !lowerPrompt.includes('no subscription');

  // Check if request is too vague
  const isVague = prompt.length < 15 ||
    (lowerPrompt.includes('something') && !category) ||
    lowerPrompt.includes('anything');

  if (isVague) {
    return {
      success: false,
      policy: null,
      clarificationQuestions: [
        'What type of product are you looking for?',
        'What is your maximum budget?',
        'Do you have any brand preferences?',
        'When do you need it delivered by?',
      ],
      rawInterpretation: 'Request is too vague to create a purchasing policy',
    };
  }

  return {
    success: true,
    policy: {
      productCategory: category,
      requiredBrand: brand,
      requiredAttributes,
      allowedCondition: condition,
      maxBudgetCents,
      currency: 'USD',
      budgetIncludesShipping: true,
      budgetIncludesTax: true,
      deliveryDeadline,
      minQuantity: 1,
      maxQuantity: 1,
      allowSubscriptions,
      allowAddOns: false,
      allowSubstitutions: false,
      allowedMerchants: null,
      blockedMerchants: [],
      requireHumanApproval: true,
      expiresAt: null,
      clarificationNeeded: [],
      approvedProducts: [],
    },
    clarificationQuestions: [],
    rawInterpretation: `Parsed shopping request for ${brand ? brand + ' ' : ''}${category}, budget $${(maxBudgetCents / 100).toFixed(2)}`,
  };
}

/**
 * Uses AI or mock based on configuration.
 */
export async function processShoppingIntent(
  prompt: string
): Promise<IntentCompilationResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return compileIntent({ prompt });
}
