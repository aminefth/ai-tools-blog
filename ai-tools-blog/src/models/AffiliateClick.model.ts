import mongoose, { Schema } from 'mongoose';
import { IAffiliateClick } from '../@types/models';

const affiliateClickSchema = new Schema<IAffiliateClick>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      index: true,
    },
    blogPostId: {
      type: Schema.Types.ObjectId,
      ref: 'Blog',
      required: true,
      index: true,
    },
    toolName: {
      type: String,
      required: true,
      index: true,
    },
    affiliateNetwork: {
      type: String,
      required: true,
      index: true,
    },
    trackingData: {
      ip: {
        type: String,
        required: true,
      },
      userAgent: {
        type: String,
        required: true,
      },
      referrer: String,
      utmSource: String,
      utmMedium: String,
      utmCampaign: String,
    },
    converted: {
      type: Boolean,
      default: false,
      index: true,
    },
    conversionValue: {
      type: Number,
    },
    clickedAt: {
      type: Date,
      required: true,
      default: Date.now,
      index: true,
    },
    convertedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
affiliateClickSchema.index({ clickedAt: -1 });
affiliateClickSchema.index({ convertedAt: -1 });
affiliateClickSchema.index({ 'trackingData.utmSource': 1, 'trackingData.utmMedium': 1 });

// Static method to get conversion rate by tool
affiliateClickSchema.statics.getConversionRateByTool = async function() {
  return this.aggregate([
    {
      $group: {
        _id: '$toolName',
        totalClicks: { $sum: 1 },
        conversions: {
          $sum: { $cond: ['$converted', 1, 0] },
        },
        totalRevenue: {
          $sum: { $ifNull: ['$conversionValue', 0] },
        },
      },
    },
    {
      $project: {
        toolName: '$_id',
        totalClicks: 1,
        conversions: 1,
        totalRevenue: 1,
        conversionRate: {
          $multiply: [
            { $divide: ['$conversions', '$totalClicks'] },
            100,
          ],
        },
      },
    },
  ]);
};

// Static method to get daily clicks
affiliateClickSchema.statics.getDailyClicks = async function(
  startDate: Date,
  endDate: Date
) {
  return this.aggregate([
    {
      $match: {
        clickedAt: {
          $gte: startDate,
          $lte: endDate,
        },
      },
    },
    {
      $group: {
        _id: {
          $dateToString: {
            format: '%Y-%m-%d',
            date: '$clickedAt',
          },
        },
        clicks: { $sum: 1 },
        conversions: {
          $sum: { $cond: ['$converted', 1, 0] },
        },
        revenue: {
          $sum: { $ifNull: ['$conversionValue', 0] },
        },
      },
    },
    {
      $sort: { _id: 1 },
    },
  ]);
};

// Method to mark as converted
affiliateClickSchema.methods.markAsConverted = async function(
  conversionValue: number
) {
  this.converted = true;
  this.conversionValue = conversionValue;
  this.convertedAt = new Date();
  return this.save();
};

export const AffiliateClick = mongoose.model<IAffiliateClick>('AffiliateClick', affiliateClickSchema);
