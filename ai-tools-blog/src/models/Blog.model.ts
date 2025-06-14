import mongoose, { Schema } from 'mongoose';
import { IBlog } from '../@types/models';
import slugify from 'slugify';

const blogSchema = new Schema<IBlog>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 200,
    },
    slug: {
      type: String,
      unique: true,
      index: true,
    },
    content: {
      type: String,
      required: true,
    },
    excerpt: {
      type: String,
      required: true,
      maxlength: 500,
    },
    author: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: [{
      type: String,
      required: true,
      index: true,
    }],
    tags: [{
      type: String,
      index: true,
    }],
    isPremium: {
      type: Boolean,
      default: false,
      index: true,
    },
    seo: {
      metaTitle: String,
      metaDescription: String,
      canonicalUrl: String,
      keywords: [String],
    },
    affiliateProducts: [{
      toolName: {
        type: String,
        required: true,
      },
      affiliateId: {
        type: String,
        required: true,
      },
      network: {
        type: String,
        required: true,
      },
      commission: {
        type: Number,
        required: true,
      },
    }],
    analytics: {
      views: {
        type: Number,
        default: 0,
      },
      uniqueVisitors: {
        type: Number,
        default: 0,
      },
      averageTimeOnPage: {
        type: Number,
        default: 0,
      },
      bounceRate: {
        type: Number,
        default: 0,
      },
      affiliateClicks: {
        type: Number,
        default: 0,
      },
      conversions: {
        type: Number,
        default: 0,
      },
      revenue: {
        type: Number,
        default: 0,
      },
    },
    translations: [{
      language: {
        type: String,
        required: true,
      },
      title: {
        type: String,
        required: true,
      },
      content: {
        type: String,
        required: true,
      },
      excerpt: {
        type: String,
        required: true,
      },
      slug: {
        type: String,
        required: true,
      },
    }],
    status: {
      type: String,
      enum: ['draft', 'published', 'archived'],
      default: 'draft',
      index: true,
    },
    publishedAt: Date,
  },
  {
    timestamps: true,
  }
);

// Indexes
blogSchema.index({ title: 'text', content: 'text' });
blogSchema.index({ 'translations.language': 1, 'translations.slug': 1 });
blogSchema.index({ createdAt: -1 });
blogSchema.index({ publishedAt: -1 });

// Generate slug before saving
blogSchema.pre('save', function(next) {
  if (this.isModified('title')) {
    this.slug = slugify(this.title, { lower: true, strict: true });
  }
  next();
});

// Virtual for reading time
blogSchema.virtual('readingTime').get(function() {
  const wordsPerMinute = 200;
  const wordCount = this.content.split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
});

// Method to increment analytics
blogSchema.methods.incrementAnalytics = async function(
  metrics: {
    views?: number;
    uniqueVisitors?: number;
    affiliateClicks?: number;
    conversions?: number;
    revenue?: number;
  }
) {
  Object.entries(metrics).forEach(([key, value]) => {
    if (value && this.analytics[key] !== undefined) {
      this.analytics[key] += value;
    }
  });
  return this.save();
};

// Method to add translation
blogSchema.methods.addTranslation = async function(
  language: string,
  translation: {
    title: string;
    content: string;
    excerpt: string;
  }
) {
  const slug = slugify(translation.title, { lower: true, strict: true });
  const existingIndex = this.translations.findIndex(t => t.language === language);
  
  if (existingIndex >= 0) {
    this.translations[existingIndex] = { ...translation, language, slug };
  } else {
    this.translations.push({ ...translation, language, slug });
  }
  
  return this.save();
};

export const Blog = mongoose.model<IBlog>('Blog', blogSchema);
