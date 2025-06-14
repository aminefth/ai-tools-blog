import { IAffiliateClick } from '../@types/models';
import { AffiliateClick, User, Blog } from '../models';
import { BaseService } from './base.service';
import { ApiError } from '../middleware/error.middleware';
import { ERROR_CODES } from '../constants';
import { logger } from '../utils/logger';
import { createRedisClient } from '../config/redis';
import { CACHE_TTL } from '../constants';

const redisClient = createRedisClient();

interface AffiliateStats {
  clicks: number;
  conversions: number;
  revenue: number;
  conversionRate: number;
  averageOrderValue: number;
}

interface ClickTrackingData {
  blogPostId: string;
  toolName: string;
  affiliateNetwork: string;
  trackingData: {
    ip: string;
    userAgent: string;
    referrer?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
  };
}

export class AffiliateService extends BaseService<IAffiliateClick> {
  constructor() {
    super(AffiliateClick);
  }

  async trackClick(data: ClickTrackingData): Promise<IAffiliateClick> {
    try {
      // Validate blog post exists and has the affiliate product
      const blog = await Blog.findById(data.blogPostId);
      if (!blog) {
        throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'Blog post not found');
      }

      const affiliateProduct = blog.affiliateProducts?.find(
        p => p.toolName === data.toolName && p.network === data.affiliateNetwork
      );

      if (!affiliateProduct) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid affiliate product'
        );
      }

      // Check for duplicate clicks from same IP within 24h
      const duplicateClick = await this.findOne({
        'trackingData.ip': data.trackingData.ip,
        toolName: data.toolName,
        createdAt: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
      });

      if (duplicateClick) {
        logger.debug('Duplicate click detected:', {
          ip: data.trackingData.ip,
          toolName: data.toolName,
        });
        return duplicateClick;
      }

      // Create click record
      const click = await this.create({
        ...data,
        userId: blog.userId,
        affiliateId: affiliateProduct.affiliateId,
        commission: affiliateProduct.commission,
      });

      // Update blog analytics
      await Blog.findByIdAndUpdate(data.blogPostId, {
        $inc: { 'analytics.affiliateClicks': 1 },
      });

      // Update user affiliate stats
      await User.findByIdAndUpdate(blog.userId, {
        $inc: { 'affiliateData.clicks': 1 },
      });

      // Clear cache
      await this.clearStatsCache(blog.userId);

      return click;
    } catch (error) {
      logger.error('Click tracking failed:', error);
      throw error;
    }
  }

  async recordConversion(
    clickId: string,
    conversionValue: number
  ): Promise<IAffiliateClick> {
    try {
      const click = await this.findById(clickId);

      if (click.converted) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Click already converted'
        );
      }

      // Calculate commission
      const commissionAmount = (conversionValue * click.commission) / 100;

      // Update click record
      click.converted = true;
      click.conversionValue = conversionValue;
      click.commissionEarned = commissionAmount;
      click.convertedAt = new Date();
      await click.save();

      // Update blog analytics
      await Blog.findByIdAndUpdate(click.blogPostId, {
        $inc: {
          'analytics.conversions': 1,
          'analytics.revenue': commissionAmount,
        },
      });

      // Update user affiliate stats
      await User.findByIdAndUpdate(click.userId, {
        $inc: {
          'affiliateData.conversions': 1,
          'affiliateData.earnings': commissionAmount,
        },
      });

      // Clear cache
      await this.clearStatsCache(click.userId);

      return click;
    } catch (error) {
      logger.error('Conversion recording failed:', error);
      throw error;
    }
  }

  async getStats(
    userId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<AffiliateStats> {
    try {
      const cacheKey = `affiliate:stats:${userId}:${startDate?.getTime() || 'all'}:${
        endDate?.getTime() || 'all'
      }`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Build date filter
      const dateFilter: any = {};
      if (startDate) dateFilter.$gte = startDate;
      if (endDate) dateFilter.$lte = endDate;

      // Get clicks and conversions
      const [clicks, conversions] = await Promise.all([
        this.count({ userId, ...(startDate || endDate ? { createdAt: dateFilter } : {}) }),
        this.find({
          userId,
          converted: true,
          ...(startDate || endDate ? { convertedAt: dateFilter } : {}),
        }),
      ]);

      // Calculate stats
      const revenue = conversions.data.reduce(
        (sum, click) => sum + (click.commissionEarned || 0),
        0
      );

      const stats: AffiliateStats = {
        clicks,
        conversions: conversions.data.length,
        revenue,
        conversionRate: clicks > 0 ? (conversions.data.length / clicks) * 100 : 0,
        averageOrderValue:
          conversions.data.length > 0
            ? revenue / conversions.data.length
            : 0,
      };

      // Cache results
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.MEDIUM,
        JSON.stringify(stats)
      );

      return stats;
    } catch (error) {
      logger.error('Stats calculation failed:', error);
      throw error;
    }
  }

  async getTopPerformingTools(
    userId: string,
    limit = 5
  ): Promise<Array<{
    toolName: string;
    clicks: number;
    conversions: number;
    revenue: number;
    conversionRate: number;
  }>> {
    try {
      const cacheKey = `affiliate:top-tools:${userId}:${limit}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const stats = await this.model.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$toolName',
            clicks: { $sum: 1 },
            conversions: {
              $sum: { $cond: [{ $eq: ['$converted', true] }, 1, 0] },
            },
            revenue: { $sum: '$commissionEarned' },
          },
        },
        {
          $project: {
            toolName: '$_id',
            clicks: 1,
            conversions: 1,
            revenue: 1,
            conversionRate: {
              $multiply: [
                { $divide: ['$conversions', '$clicks'] },
                100,
              ],
            },
          },
        },
        { $sort: { revenue: -1 } },
        { $limit: limit },
      ]);

      // Cache results
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.MEDIUM,
        JSON.stringify(stats)
      );

      return stats;
    } catch (error) {
      logger.error('Top tools calculation failed:', error);
      throw error;
    }
  }

  private async clearStatsCache(userId: string): Promise<void> {
    try {
      const patterns = [
        `affiliate:stats:${userId}:*`,
        `affiliate:top-tools:${userId}:*`,
      ];

      await Promise.all(
        patterns.map(pattern =>
          redisClient
            .keys(pattern)
            .then(keys => keys.length > 0 ? redisClient.del(keys) : null)
        )
      );

      logger.debug('Affiliate stats cache cleared');
    } catch (error) {
      logger.error('Cache clearing failed:', error);
      throw error;
    }
  }
}
