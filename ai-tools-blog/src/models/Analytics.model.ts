import mongoose, { Schema } from 'mongoose';
import { IAnalytics } from '../@types/models';

const analyticsSchema = new Schema<IAnalytics>(
  {
    date: {
      type: Date,
      required: true,
      unique: true,
      index: true,
    },
    revenue: {
      total: {
        type: Number,
        required: true,
        default: 0,
      },
      affiliate: {
        type: Number,
        required: true,
        default: 0,
      },
      subscriptions: {
        type: Number,
        required: true,
        default: 0,
      },
      sponsored: {
        type: Number,
        required: true,
        default: 0,
      },
      currency: {
        type: String,
        required: true,
        default: 'EUR',
      },
    },
    traffic: {
      pageViews: {
        type: Number,
        required: true,
        default: 0,
      },
      uniqueVisitors: {
        type: Number,
        required: true,
        default: 0,
      },
      averageSessionDuration: {
        type: Number,
        required: true,
        default: 0,
      },
      bounceRate: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    conversions: {
      affiliateClicks: {
        type: Number,
        required: true,
        default: 0,
      },
      affiliateConversions: {
        type: Number,
        required: true,
        default: 0,
      },
      subscriptionSignups: {
        type: Number,
        required: true,
        default: 0,
      },
      conversionRate: {
        type: Number,
        required: true,
        default: 0,
      },
    },
    content: {
      totalPosts: {
        type: Number,
        required: true,
        default: 0,
      },
      premiumPosts: {
        type: Number,
        required: true,
        default: 0,
      },
      topPerformingPosts: [{
        postId: {
          type: Schema.Types.ObjectId,
          ref: 'Blog',
          required: true,
        },
        views: {
          type: Number,
          required: true,
        },
        revenue: {
          type: Number,
          required: true,
        },
      }],
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
analyticsSchema.index({ date: -1 });
analyticsSchema.index({ 'revenue.total': -1 });
analyticsSchema.index({ 'conversions.conversionRate': -1 });

// Static method to get revenue trends
analyticsSchema.statics.getRevenueTrends = async function(
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
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
          $dateToString: {
            format: '%Y-%m',
            date: '$date',
          },
        },
        totalRevenue: { $sum: '$revenue.total' },
        affiliateRevenue: { $sum: '$revenue.affiliate' },
        subscriptionRevenue: { $sum: '$revenue.subscriptions' },
        sponsoredRevenue: { $sum: '$revenue.sponsored' },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

// Static method to get conversion metrics
analyticsSchema.statics.getConversionMetrics = async function(
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
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
        _id: null,
        totalClicks: { $sum: '$conversions.affiliateClicks' },
        totalConversions: { $sum: '$conversions.affiliateConversions' },
        totalSignups: { $sum: '$conversions.subscriptionSignups' },
        averageConversionRate: { $avg: '$conversions.conversionRate' },
      },
    },
  ]);
};

// Method to update daily metrics
analyticsSchema.methods.updateMetrics = async function(
  metrics: Partial<IAnalytics>
) {
  Object.entries(metrics).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      Object.entries(value).forEach(([subKey, subValue]) => {
        if (subValue !== undefined && this[key]?.[subKey] !== undefined) {
          this[key][subKey] = subValue;
        }
      });
    }
  });
  
  // Recalculate conversion rate
  if (this.conversions.affiliateClicks > 0) {
    this.conversions.conversionRate = (this.conversions.affiliateConversions / this.conversions.affiliateClicks) * 100;
  }
  
  return this.save();
};

export const Analytics = mongoose.model<IAnalytics>('Analytics', analyticsSchema);
