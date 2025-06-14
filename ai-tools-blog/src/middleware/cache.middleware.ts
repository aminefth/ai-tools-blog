import { Request, Response, NextFunction } from 'express';
import { createRedisClient } from '../config/redis';
import { CACHE_TTL } from '../constants';
import { logger } from '../utils/logger';

const redisClient = createRedisClient();

interface CacheOptions {
  ttl?: number;
  key?: string | ((req: Request) => string);
  condition?: (req: Request) => boolean;
}

export const cache = (options: CacheOptions = {}) => {
  const {
    ttl = CACHE_TTL.MEDIUM,
    key,
    condition = () => true,
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    if (!condition(req)) {
      return next();
    }

    const cacheKey = typeof key === 'function' 
      ? key(req) 
      : key || `${req.method}:${req.originalUrl}`;

    try {
      const cachedData = await redisClient.get(cacheKey);

      if (cachedData) {
        const data = JSON.parse(cachedData);
        logger.debug(`Cache hit for key: ${cacheKey}`);
        return res.json(data);
      }

      // Store original send function
      const originalSend = res.json;

      // Override res.json method
      res.json = function (body: any): Response {
        // Restore original function
        res.json = originalSend;

        // Cache the response
        redisClient.setex(cacheKey, ttl, JSON.stringify(body))
          .catch(err => logger.error('Redis cache error:', err));

        logger.debug(`Cache miss for key: ${cacheKey}`);
        
        // Call original function
        return originalSend.call(this, body);
      };

      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

export const clearCache = (pattern: string) => {
  return new Promise<void>((resolve, reject) => {
    redisClient.keys(pattern)
      .then(keys => {
        if (keys.length > 0) {
          return redisClient.del(keys);
        }
      })
      .then(() => {
        logger.debug(`Cache cleared for pattern: ${pattern}`);
        resolve();
      })
      .catch(error => {
        logger.error('Clear cache error:', error);
        reject(error);
      });
  });
};
