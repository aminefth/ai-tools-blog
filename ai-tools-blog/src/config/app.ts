import { config } from 'dotenv';

// Load environment variables
config();

export const appConfig = {
  stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  paddleApiKey: process.env.PADDLE_API_KEY,
  nodeEnv: process.env.NODE_ENV || 'development',
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  apiPrefix: '/api/v1',
  
  // Security
  jwtSecret: process.env.JWT_SECRET,
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1h',
  jwtRefreshSecret: process.env.JWT_REFRESH_SECRET,
  jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d',
  bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '12', 10),
  
  // Rate Limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per windowMs
  },
  
  // Monetization
  stripe: {
    secretKey: process.env.STRIPE_SECRET_KEY,
    webhookSecret: process.env.STRIPE_WEBHOOK_SECRET,
    currency: process.env.STRIPE_CURRENCY || 'eur',
  },
  
  paddle: {
    vendorId: process.env.PADDLE_VENDOR_ID,
    apiKey: process.env.PADDLE_API_KEY,
    publicKey: process.env.PADDLE_PUBLIC_KEY,
  },
  
  // Cache
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD,
  },
  
  // Email
  email: {
    from: process.env.EMAIL_FROM || 'noreply@aitools.blog',
    smtp: {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    },
  },
  
  // Analytics
  googleAnalytics: process.env.GA_TRACKING_ID,
  mixpanel: process.env.MIXPANEL_TOKEN,
  
  // Content Delivery
  cdnUrl: process.env.CDN_URL,
  
  // Monitoring
  sentry: {
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  },
  
  // Revenue Goals
  revenueTargets: {
    monthly: 2000, // EUR
    affiliateShare: 0.45, // 45%
    subscriptionShare: 0.35, // 35%
    sponsoredShare: 0.20, // 20%
  },
};
