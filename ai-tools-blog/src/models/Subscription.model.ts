import mongoose, { Schema } from 'mongoose';
import { ISubscription } from '../@types/models';

const subscriptionSchema = new Schema<ISubscription>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    plan: {
      type: String,
      enum: ['basic', 'pro', 'enterprise'],
      required: true,
    },
    status: {
      type: String,
      enum: ['active', 'canceled', 'past_due'],
      required: true,
      index: true,
    },
    externalId: {
      type: String,
      required: true,
      unique: true,
    },
    paymentMethod: {
      type: String,
      enum: ['stripe', 'paddle'],
      required: true,
    },
    price: {
      type: Number,
      required: true,
    },
    currency: {
      type: String,
      required: true,
      default: 'EUR',
    },
    expiresAt: {
      type: Date,
      required: true,
      index: true,
    },
    features: [{
      name: {
        type: String,
        required: true,
      },
      enabled: {
        type: Boolean,
        default: true,
      },
    }],
    billingHistory: [{
      amount: {
        type: Number,
        required: true,
      },
      currency: {
        type: String,
        required: true,
      },
      status: {
        type: String,
        enum: ['succeeded', 'failed'],
        required: true,
      },
      date: {
        type: Date,
        required: true,
      },
    }],
  },
  {
    timestamps: true,
  }
);

// Indexes
subscriptionSchema.index({ userId: 1, status: 1 });
subscriptionSchema.index({ expiresAt: 1, status: 1 });
subscriptionSchema.index({ externalId: 1 });

// Method to check if subscription is active
subscriptionSchema.methods.isActive = function(): boolean {
  return this.status === 'active' && this.expiresAt > new Date();
};

// Method to add billing record
subscriptionSchema.methods.addBillingRecord = async function(
  amount: number,
  currency: string,
  status: 'succeeded' | 'failed'
) {
  this.billingHistory.push({
    amount,
    currency,
    status,
    date: new Date(),
  });
  return this.save();
};

// Method to calculate total revenue
subscriptionSchema.methods.getTotalRevenue = function(): number {
  return this.billingHistory
    .filter(record => record.status === 'succeeded')
    .reduce((total, record) => total + record.amount, 0);
};

// Static method to get active subscriptions count by plan
subscriptionSchema.statics.getActiveSubscriptionsByPlan = async function() {
  return this.aggregate([
    {
      $match: {
        status: 'active',
        expiresAt: { $gt: new Date() },
      },
    },
    {
      $group: {
        _id: '$plan',
        count: { $sum: 1 },
        revenue: { $sum: '$price' },
      },
    },
  ]);
};

export const Subscription = mongoose.model<ISubscription>('Subscription', subscriptionSchema);
