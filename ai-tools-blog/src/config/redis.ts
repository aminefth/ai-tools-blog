import Redis from 'ioredis';
import { logger } from '../utils/logger';

export const createRedisClient = (): Redis => {
  const redisClient = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    password: process.env.REDIS_PASSWORD,
    maxRetriesPerRequest: 3,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      return Math.min(times * 100, 3000);
    },
  });

  redisClient.on('error', (error) => {
    logger.error('Redis client error:', error);
  });

  redisClient.on('connect', () => {
    logger.info('Redis client connected successfully');
  });

  return redisClient;
};
