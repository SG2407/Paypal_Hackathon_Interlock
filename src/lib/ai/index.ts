// AI Module Exports
export {
  compileIntent,
  compileIntentMock,
  processShoppingIntent,
} from './intent-compiler';

export {
  recommendProducts,
  recommendProductsMock,
  scoreProductMatch,
  matchProducts,
} from './product-matcher';

export {
  INTENT_COMPILER_SYSTEM_PROMPT,
  PRODUCT_RECOMMENDATION_SYSTEM_PROMPT,
} from './prompts';
