import OpenAI from 'openai';
import {
  PermissionPolicy,
  AIRecommendationResponse,
  AIRecommendationResponseSchema,
  ProductRecommendation,
} from '@/types/policy';
import { Product } from '@/types/product';
import { PRODUCT_RECOMMENDATION_SYSTEM_PROMPT } from './prompts';

// Initialize OpenAI client
function getOpenAIClient(): OpenAI {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }
  return new OpenAI({ apiKey });
}

/**
 * Format product for AI context
 */
function formatProductForAI(product: Product): string {
  const total = (product.priceCents + product.shippingCents + product.taxEstimateCents) / 100;
  return `
ID: ${product.id}
Name: ${product.name}
Brand: ${product.brand}
Category: ${product.category}
Price: $${(product.priceCents / 100).toFixed(2)} (Total with shipping/tax: $${total.toFixed(2)})
Condition: ${product.condition}
Delivery: ${product.deliveryDate}
Merchant: ${product.merchantName}
Has Subscription: ${product.hasSubscription}
Attributes: ${JSON.stringify(product.attributes)}
Description: ${product.description}
`.trim();
}

/**
 * Format policy for AI context
 */
function formatPolicyForAI(policy: PermissionPolicy): string {
  return `
Product Category: ${policy.productCategory}
Required Brand: ${policy.requiredBrand || 'Any'}
Max Budget: $${(policy.maxBudgetCents / 100).toFixed(2)} (${policy.budgetIncludesShipping ? 'includes' : 'excludes'} shipping/tax)
Condition: ${policy.allowedCondition}
Delivery Deadline: ${policy.deliveryDeadline || 'No deadline'}
Required Attributes: ${JSON.stringify(policy.requiredAttributes)}
Subscriptions Allowed: ${policy.allowSubscriptions}
Substitutions Allowed: ${policy.allowSubstitutions}
`.trim();
}

interface RecommendProductsOptions {
  policy: PermissionPolicy;
  products: Product[];
  maxRecommendations?: number;
}

/**
 * Uses AI to recommend products that match the buyer's policy.
 */
export async function recommendProducts(
  options: RecommendProductsOptions
): Promise<AIRecommendationResponse> {
  const { policy, products, maxRecommendations = 5 } = options;
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  if (products.length === 0) {
    return {
      recommendations: [],
      reasoning: 'No products available to recommend',
    };
  }

  try {
    const client = getOpenAIClient();
    const model = process.env.OPENAI_MODEL || 'gpt-4o';

    // Format context
    const policyContext = formatPolicyForAI(policy);
    const productsContext = products.map(formatProductForAI).join('\n\n---\n\n');

    const userPrompt = `
Buyer's Shopping Policy:
${policyContext}

Available Products:
${productsContext}

Please recommend up to ${maxRecommendations} products that best match this policy. Rank them by match quality.
`.trim();

    const response = await client.chat.completions.create({
      model,
      messages: [
        { role: 'system', content: PRODUCT_RECOMMENDATION_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
      temperature: 0.3,
      max_tokens: 2000,
    });

    const content = response.choices[0]?.message?.content;
    if (!content) {
      throw new Error('No response from OpenAI');
    }

    const parsed = JSON.parse(content);

    // Validate and ensure product IDs exist
    const validRecommendations: ProductRecommendation[] = [];
    const productIds = new Set(products.map(p => p.id));

    for (const rec of (parsed.recommendations || [])) {
      if (productIds.has(rec.productId)) {
        validRecommendations.push({
          productId: rec.productId,
          rank: rec.rank,
          explanation: rec.explanation || '',
          matchScore: Math.min(100, Math.max(0, rec.matchScore || 0)),
        });
      }
    }

    return AIRecommendationResponseSchema.parse({
      recommendations: validRecommendations.slice(0, maxRecommendations),
      reasoning: parsed.reasoning || 'Products ranked by policy match',
    });
  } catch (error) {
    console.error('Product recommendation error:', error);
    throw new Error('Product recommendation failed. Verify the OpenAI API configuration and retry.');
  }
}

/**
 * Deterministic product scoring without AI.
 * Calculates a match score based on policy criteria.
 */
export function scoreProductMatch(
  product: Product,
  policy: PermissionPolicy
): { score: number; reasons: string[] } {
  let score = 100;
  const reasons: string[] = [];
  const totalCents = product.priceCents + product.shippingCents + product.taxEstimateCents;

  // Category match (critical)
  if (product.category.toLowerCase() !== policy.productCategory.toLowerCase()) {
    // Check for partial match
    if (!product.category.toLowerCase().includes(policy.productCategory.toLowerCase()) &&
        !policy.productCategory.toLowerCase().includes(product.category.toLowerCase())) {
      score -= 50;
      reasons.push(`Category mismatch: ${product.category} vs ${policy.productCategory}`);
    } else {
      score -= 10;
      reasons.push('Partial category match');
    }
  }

  // Brand match
  if (policy.requiredBrand) {
    if (product.brand.toLowerCase() !== policy.requiredBrand.toLowerCase()) {
      score -= 30;
      reasons.push(`Brand mismatch: ${product.brand} vs ${policy.requiredBrand}`);
    } else {
      score += 10;
      reasons.push('Exact brand match');
    }
  }

  // Budget check
  if (totalCents > policy.maxBudgetCents) {
    const overBudget = ((totalCents - policy.maxBudgetCents) / policy.maxBudgetCents) * 100;
    score -= Math.min(40, overBudget);
    reasons.push(`Over budget by $${((totalCents - policy.maxBudgetCents) / 100).toFixed(2)}`);
  } else {
    // Bonus for being under budget
    const underBudget = ((policy.maxBudgetCents - totalCents) / policy.maxBudgetCents) * 100;
    score += Math.min(10, underBudget / 5);
    reasons.push('Within budget');
  }

  // Condition match
  if (policy.allowedCondition !== 'any') {
    if (product.condition !== policy.allowedCondition) {
      score -= 20;
      reasons.push(`Condition mismatch: ${product.condition} vs ${policy.allowedCondition}`);
    }
  }

  // Delivery deadline
  if (policy.deliveryDeadline) {
    const deadline = new Date(policy.deliveryDeadline);
    const delivery = new Date(product.deliveryDate);
    if (delivery > deadline) {
      const daysBeyond = Math.ceil((delivery.getTime() - deadline.getTime()) / (24 * 60 * 60 * 1000));
      score -= Math.min(30, daysBeyond * 5);
      reasons.push(`Delivery ${daysBeyond} days after deadline`);
    }
  }

  // Required attributes
  for (const reqAttr of policy.requiredAttributes) {
    const productValue = product.attributes?.[reqAttr.attribute];
    if (!productValue || typeof productValue !== 'string') {
      score -= reqAttr.required ? 25 : 10;
      reasons.push(`Missing attribute: ${reqAttr.attribute}`);
    } else if (productValue.toLowerCase() !== reqAttr.value.toLowerCase()) {
      score -= reqAttr.required ? 20 : 5;
      reasons.push(`Attribute mismatch: ${reqAttr.attribute} (${productValue} vs ${reqAttr.value})`);
    }
  }

  // Subscription check
  if (product.hasSubscription && !policy.allowSubscriptions) {
    score -= 15;
    reasons.push('Product has unwanted subscription');
  }

  // Clamp score
  score = Math.max(0, Math.min(100, score));

  return { score, reasons };
}

/**
 * Mock/deterministic product matcher for testing.
 */
export function recommendProductsMock(
  options: RecommendProductsOptions
): AIRecommendationResponse {
  const { policy, products, maxRecommendations = 5 } = options;

  // Score all products
  const scoredProducts = products.map(product => {
    const { score, reasons } = scoreProductMatch(product, policy);
    return {
      product,
      score,
      reasons,
    };
  });

  // Sort by score descending
  scoredProducts.sort((a, b) => b.score - a.score);

  // Take top recommendations with score > 30
  const recommendations: ProductRecommendation[] = scoredProducts
    .filter(sp => sp.score >= 30)
    .slice(0, maxRecommendations)
    .map((sp, index) => ({
      productId: sp.product.id,
      rank: index + 1,
      explanation: sp.reasons.join('. '),
      matchScore: sp.score,
    }));

  const reasoning = recommendations.length > 0
    ? `Found ${recommendations.length} products matching the policy. Best match: ${scoredProducts[0]?.product.name} with ${scoredProducts[0]?.score}% match.`
    : 'No products match the specified criteria well enough for recommendation.';

  return {
    recommendations,
    reasoning,
  };
}

/**
 * Uses AI or mock based on configuration.
 */
export async function matchProducts(
  policy: PermissionPolicy,
  products: Product[]
): Promise<AIRecommendationResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY environment variable is not set');
  }

  return recommendProducts({ policy, products });
}
