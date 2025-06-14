export const CACHE_KEYS = {
  USER_PROFILE: 'user:profile:',
  BLOG_POST: 'blog:post:',
  AFFILIATE_STATS: 'affiliate:stats:',
  REVENUE_METRICS: 'revenue:metrics:',
  PERFORMANCE_METRICS: 'performance:metrics:',
};

export const CACHE_TTL = {
  SHORT: 300, // 5 minutes
  MEDIUM: 1800, // 30 minutes
  LONG: 86400, // 24 hours
  WEEK: 604800, // 7 days
};

export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  PAYMENT_FAILED: 'PAYMENT_FAILED',
  SERVER_ERROR: 'SERVER_ERROR',
};

export const SUBSCRIPTION_PLANS = {
  BASIC: {
    name: 'basic',
    price: 15,
    features: ['Full blog access', 'Email updates', 'Community access'],
  },
  PRO: {
    name: 'pro',
    price: 29,
    features: ['Basic features', 'Premium content', 'Priority support', 'No ads'],
  },
  ENTERPRISE: {
    name: 'enterprise',
    price: 39,
    features: ['Pro features', 'Custom solutions', 'Dedicated support', 'API access'],
  },
};

export const AFFILIATE_NETWORKS = {
  PADDLE: 'paddle',
  STRIPE: 'stripe',
  IMPACT: 'impact',
  CLICKBANK: 'clickbank',
};

export const REVENUE_GOALS = {
  MONTHLY_TARGET: 2000,
  AFFILIATE_SHARE: 0.45,
  SUBSCRIPTION_SHARE: 0.35,
  SPONSORED_SHARE: 0.20,
};

export const PERFORMANCE_THRESHOLDS = {
  API_RESPONSE_TIME: 200, // ms
  CACHE_HIT_RATE: 0.8, // 80%
  ERROR_RATE: 0.001, // 0.1%
  CPU_USAGE: 0.7, // 70%
  MEMORY_USAGE: 0.8, // 80%
};

export const LANGUAGES = {
  EN: 'en',
  FR: 'fr',
  DE: 'de',
};
