import mongoose, { Schema } from 'mongoose';
import bcrypt from 'bcrypt';
import { IUser } from '../@types/models';

const userSchema = new Schema<IUser>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: ['admin', 'editor', 'subscriber', 'guest'],
      default: 'guest',
    },
    profile: {
      name: { type: String, required: true },
      avatar: String,
      bio: String,
    },
    subscription: {
      status: {
        type: String,
        enum: ['active', 'canceled', 'past_due'],
      },
      plan: {
        type: String,
        enum: ['basic', 'pro', 'enterprise'],
      },
      externalId: String,
      paymentMethod: {
        type: String,
        enum: ['stripe', 'paddle'],
      },
      expiresAt: Date,
    },
    affiliateData: {
      referralCode: {
        type: String,
        unique: true,
        sparse: true,
        index: true,
      },
      earnings: {
        type: Number,
        default: 0,
      },
      clicks: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
    },
  },
  {
    timestamps: true,
  }
);

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ 'affiliateData.referralCode': 1 });
userSchema.index({ 'subscription.status': 1, 'subscription.expiresAt': 1 });

// Password hashing middleware
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  try {
    const salt = await bcrypt.genSalt(Number(process.env.BCRYPT_ROUNDS) || 12);
    this.password = await bcrypt.hash(this.password, salt);
    return next();
  } catch (error: any) {
    return next(error);
  }
});

// Method to check password
userSchema.methods.comparePassword = async function (candidatePassword: string): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

// Method to check subscription status
userSchema.methods.hasActiveSubscription = function (): boolean {
  return (
    this.subscription &&
    this.subscription.status === 'active' &&
    this.subscription.expiresAt > new Date()
  );
};

// Virtual for full name
userSchema.virtual('fullName').get(function () {
  return this.profile.name;
});

// Method to update affiliate stats
userSchema.methods.updateAffiliateStats = async function (
  clickIncrement = 0,
  conversionIncrement = 0,
  earningsIncrement = 0
) {
  this.affiliateData.clicks += clickIncrement;
  this.affiliateData.conversions += conversionIncrement;
  this.affiliateData.earnings += earningsIncrement;
  return this.save();
};

export const User = mongoose.model<IUser>('User', userSchema);
