import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createRedisClient } from '../config/redis';
import { appConfig } from '../config/app';

const redisClient = createRedisClient();

export const rateLimiter = rateLimit({
  store: new RedisStore({
    sendCommand: (...args: string[]) => redisClient.call(...args),
  }),
  windowMs: appConfig.rateLimit.windowMs,
  max: appConfig.rateLimit.max,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later.',
    },
  },
});
