import { IAnalytics } from '../@types/models';
import { Analytics, Blog } from '../models';
import { BaseService } from './base.service';
import { logger } from '../utils/logger';
import { createRedisClient } from '../config/redis';
import { CACHE_TTL } from '../constants';

const redisClient = createRedisClient();

interface RevenueMetrics {
  total: number;
  affiliate: number;
  subscriptions: number;
  sponsored: number;
}

interface TrafficMetrics {
  pageViews: number;
  uniqueVisitors: number;
  averageSessionDuration: number;
  bounceRate: number;
}

interface ConversionMetrics {
  affiliateClicks: number;
  affiliateConversions: number;
  subscriptionSignups: number;
  conversionRate: number;
}

interface ContentMetrics {
  totalPosts: number;
  premiumPosts: number;
  topPerformingPosts: Array<{
    postId: string;
    views: number;
    revenue: number;
  }>;
}

export class AnalyticsService extends BaseService<IAnalytics> {
  constructor() {
    super(Analytics);
  }

  async recordDailyMetrics(): Promise<IAnalytics> {
    try {
      const date = new Date();
      date.setHours(0, 0, 0, 0);

      // Check if metrics already exist for today
      const existingMetrics = await this.findOne({ date });
      if (existingMetrics) {
        return existingMetrics;
      }

      const [revenue, traffic, conversions, content] = await Promise.all([
        this.calculateRevenueMetrics(date),
        this.calculateTrafficMetrics(date),
        this.calculateConversionMetrics(date),
        this.calculateContentMetrics(date),
      ]);

      const analytics = await this.create({
        date,
        revenue,
        traffic,
        conversions,
        content,
      });

      // Clear cache
      await this.clearMetricsCache();

      return analytics;
    } catch (error) {
      logger.error('Daily metrics recording failed:', error);
      throw error;
    }
  }

  async getMetricsByDateRange(
    startDate: Date,
    endDate: Date,
    groupBy: 'day' | 'week' | 'month' | 'year' = 'day'
  ): Promise<Array<IAnalytics>> {
    try {
      const cacheKey = `analytics:metrics:${startDate.getTime()}:${endDate.getTime()}:${groupBy}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      const metrics = await this.model.aggregate([
        {
          $match: {
            date: {
              $gte: startDate,
              $lte: endDate,
            },
          },
        },
        {
          $group: {
            _id: {
              $switch: {
                branches: [
                  {
                    case: { $eq: [groupBy, 'week'] },
                    then: { $week: '$date' },
                  },
                  {
                    case: { $eq: [groupBy, 'month'] },
                    then: { $month: '$date' },
                  },
                  {
                    case: { $eq: [groupBy, 'year'] },
                    then: { $year: '$date' },
                  },
                ],
                default: { $dayOfYear: '$date' },
              },
            },
            date: { $first: '$date' },
            revenue: { $first: '$revenue' },
            traffic: { $first: '$traffic' },
            conversions: { $first: '$conversions' },
            content: { $first: '$content' },
          },
        },
        { $sort: { date: 1 } },
      ]);

      // Cache results
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.LONG,
        JSON.stringify(metrics)
      );

      return metrics;
    } catch (error) {
      logger.error('Metrics retrieval failed:', error);
      throw error;
    }
  }

  async getRevenueProjection(
    months: number = 6
  ): Promise<Array<{ month: Date; projected: number; actual?: number }>> {
    try {
      const cacheKey = `analytics:revenue-projection:${months}`;

      // Try to get from cache
      const cached = await redisClient.get(cacheKey);
      if (cached) {
        return JSON.parse(cached);
      }

      // Get historical revenue data
      const historicalData = await this.model
        .find({}, 'date revenue.total')
        .sort({ date: -1 })
        .limit(90); // Last 90 days

      // Calculate average daily growth rate
      const dailyGrowthRates = [];
      for (let i = 1; i < historicalData.length; i++) {
        const today = historicalData[i - 1].revenue.total;
        const yesterday = historicalData[i].revenue.total;
        if (yesterday > 0) {
          dailyGrowthRates.push((today - yesterday) / yesterday);
        }
      }

      const avgDailyGrowthRate =
        dailyGrowthRates.reduce((a, b) => a + b, 0) / dailyGrowthRates.length;

      // Project future revenue
      const projection = [];
      const today = new Date();
      let lastRevenue =
        historicalData[0]?.revenue.total ||
        0;

      for (let i = 1; i <= months * 30; i++) {
        const date = new Date(today);
        date.setDate(date.getDate() + i);
        
        // Apply compound growth
        lastRevenue *= 1 + avgDailyGrowthRate;

        // Group by month
        if (i % 30 === 0) {
          projection.push({
            month: new Date(date.getFullYear(), date.getMonth(), 1),
            projected: Math.round(lastRevenue * 30), // Monthly revenue
          });
        }
      }

      // Cache results
      await redisClient.setex(
        cacheKey,
        CACHE_TTL.LONG,
        JSON.stringify(projection)
      );

      return projection;
    } catch (error) {
      logger.error('Revenue projection failed:', error);
      throw error;
    }
  }

  private async calculateRevenueMetrics(date: Date): Promise<RevenueMetrics> {
    // Get revenue from different sources for the given date
    const [affiliateRevenue, subscriptionRevenue, sponsoredRevenue] =
      await Promise.all([
        this.model.aggregate([
          {
            $match: {
              'content.topPerformingPosts.revenue': { $exists: true },
              date: {
                $gte: new Date(date.getTime() - 24 * 60 * 60 * 1000),
                $lt: date,
              },
            },
          },
          {
            $group: {
              _id: null,
              total: { $sum: '$content.topPerformingPosts.revenue' },
            },
          },
        ]),
        0, // TODO: Implement subscription revenue calculation
        0, // TODO: Implement sponsored content revenue calculation
      ]);

    const total = (affiliateRevenue[0]?.total || 0) +
      subscriptionRevenue +
      sponsoredRevenue;

    return {
      total,
      affiliate: affiliateRevenue[0]?.total || 0,
      subscriptions: subscriptionRevenue,
      sponsored: sponsoredRevenue,
    };
  }

  private async calculateTrafficMetrics(date: Date): Promise<TrafficMetrics> {
    // Aggregate traffic metrics from blog posts
    const metrics = await Blog.aggregate([
      {
        $match: {
          'analytics.lastUpdated': {
            $gte: new Date(date.getTime() - 24 * 60 * 60 * 1000),
            $lt: date,
          },
        },
      },
      {
        $group: {
          _id: null,
          pageViews: { $sum: '$analytics.views' },
          uniqueVisitors: { $sum: '$analytics.uniqueVisitors' },
          totalSessionDuration: {
            $sum: {
              $multiply: ['$analytics.views', '$analytics.averageTimeOnPage'],
            },
          },
          bounces: { $sum: '$analytics.bounces' },
        },
      },
    ]);

    const traffic = metrics[0] || {
      pageViews: 0,
      uniqueVisitors: 0,
      totalSessionDuration: 0,
      bounces: 0,
    };

    return {
      pageViews: traffic.pageViews,
      uniqueVisitors: traffic.uniqueVisitors,
      averageSessionDuration:
        traffic.pageViews > 0
          ? traffic.totalSessionDuration / traffic.pageViews
          : 0,
      bounceRate:
        traffic.pageViews > 0
          ? (traffic.bounces / traffic.pageViews) * 100
          : 0,
    };
  }

  private async calculateConversionMetrics(
    date: Date
  ): Promise<ConversionMetrics> {
    // Get conversion metrics from blogs
    const metrics = await Blog.aggregate([
      {
        $match: {
          'analytics.lastUpdated': {
            $gte: new Date(date.getTime() - 24 * 60 * 60 * 1000),
            $lt: date,
          },
        },
      },
      {
        $group: {
          _id: null,
          affiliateClicks: { $sum: '$analytics.affiliateClicks' },
          affiliateConversions: { $sum: '$analytics.conversions' },
        },
      },
    ]);

    const conversions = metrics[0] || {
      affiliateClicks: 0,
      affiliateConversions: 0,
    };

    return {
      affiliateClicks: conversions.affiliateClicks,
      affiliateConversions: conversions.affiliateConversions,
      subscriptionSignups: 0, // TODO: Implement subscription signup tracking
      conversionRate:
        conversions.affiliateClicks > 0
          ? (conversions.affiliateConversions / conversions.affiliateClicks) * 100
          : 0,
    };
  }

  private async calculateContentMetrics(date: Date): Promise<ContentMetrics> {
    // Get content metrics
    const [totalPosts, premiumPosts, topPosts] = await Promise.all([
      Blog.countDocuments({ status: 'published' }),
      Blog.countDocuments({ status: 'published', isPremium: true }),
      Blog.find(
        {
          status: 'published',
          'analytics.lastUpdated': {
            $gte: new Date(date.getTime() - 24 * 60 * 60 * 1000),
            $lt: date,
          },
        },
        {
          _id: 1,
          'analytics.views': 1,
          'analytics.revenue': 1,
        }
      )
        .sort({ 'analytics.revenue': -1 })
        .limit(10),
    ]);

    return {
      totalPosts,
      premiumPosts,
      topPerformingPosts: topPosts.map(post => ({
        postId: post._id.toString(),
        views: post.analytics.views,
        revenue: post.analytics.revenue,
      })),
    };
  }

  private async clearMetricsCache(): Promise<void> {
    try {
      const patterns = [
        'analytics:metrics:*',
        'analytics:revenue-projection:*',
      ];

      await Promise.all(
        patterns.map(pattern =>
          redisClient
            .keys(pattern)
            .then(keys => keys.length > 0 ? redisClient.del(keys) : null)
        )
      );

      logger.debug('Analytics metrics cache cleared');
    } catch (error) {
      logger.error('Cache clearing failed:', error);
      throw error;
    }
  }
}
