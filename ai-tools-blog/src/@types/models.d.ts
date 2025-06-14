import { Document, Types } from 'mongoose';

export interface IUser extends Document {
  email: string;
  password: string;
  role: 'admin' | 'editor' | 'subscriber' | 'guest';
  profile: {
    name: string;
    avatar?: string;
    bio?: string;
  };
  subscription?: {
    status: 'active' | 'canceled' | 'past_due';
    plan: 'basic' | 'pro' | 'enterprise';
    externalId: string;
    paymentMethod: 'stripe' | 'paddle';
    expiresAt: Date;
  };
  affiliateData: {
    referralCode: string;
    earnings: number;
    clicks: number;
    conversions: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

export interface IBlog extends Document {
  title: string;
  slug: string;
  content: string;
  excerpt: string;
  author: Types.ObjectId;
  category: string[];
  tags: string[];
  isPremium: boolean;
  seo: {
    metaTitle: string;
    metaDescription: string;
    canonicalUrl?: string;
    keywords: string[];
  };
  affiliateProducts: Array<{
    toolName: string;
    affiliateId: string;
    network: string;
    commission: number;
  }>;
  analytics: {
    views: number;
    uniqueVisitors: number;
    averageTimeOnPage: number;
    bounceRate: number;
    affiliateClicks: number;
    conversions: number;
    revenue: number;
  };
  translations: Array<{
    language: string;
    title: string;
    content: string;
    excerpt: string;
    slug: string;
  }>;
  status: 'draft' | 'published' | 'archived';
  publishedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface ISubscription extends Document {
  userId: Types.ObjectId;
  plan: 'basic' | 'pro' | 'enterprise';
  status: 'active' | 'canceled' | 'past_due';
  externalId: string;
  paymentMethod: 'stripe' | 'paddle';
  price: number;
  currency: string;
  expiresAt: Date;
  features: Array<{
    name: string;
    enabled: boolean;
  }>;
  billingHistory: Array<{
    amount: number;
    currency: string;
    status: 'succeeded' | 'failed';
    date: Date;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAffiliateClick extends Document {
  userId?: Types.ObjectId;
  blogPostId: Types.ObjectId;
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
  converted: boolean;
  conversionValue?: number;
  clickedAt: Date;
  convertedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

export interface IAnalytics extends Document {
  date: Date;
  revenue: {
    total: number;
    affiliate: number;
    subscriptions: number;
    sponsored: number;
    currency: string;
  };
  traffic: {
    pageViews: number;
    uniqueVisitors: number;
    averageSessionDuration: number;
    bounceRate: number;
  };
  conversions: {
    affiliateClicks: number;
    affiliateConversions: number;
    subscriptionSignups: number;
    conversionRate: number;
  };
  content: {
    totalPosts: number;
    premiumPosts: number;
    topPerformingPosts: Array<{
      postId: Types.ObjectId;
      views: number;
      revenue: number;
    }>;
  };
  createdAt: Date;
  updatedAt: Date;
}
