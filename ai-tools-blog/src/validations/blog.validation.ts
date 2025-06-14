import Joi from 'joi';
import { LANGUAGES } from '../constants';

export const blogValidation = {
  create: Joi.object({
    body: Joi.object({
      title: Joi.string().max(200).required(),
      content: Joi.string().required(),
      excerpt: Joi.string().max(500).required(),
      category: Joi.array().items(Joi.string()).min(1).required(),
      tags: Joi.array().items(Joi.string()),
      isPremium: Joi.boolean(),
      seo: Joi.object({
        metaTitle: Joi.string().max(60),
        metaDescription: Joi.string().max(160),
        canonicalUrl: Joi.string().uri(),
        keywords: Joi.array().items(Joi.string()),
      }),
      affiliateProducts: Joi.array().items(
        Joi.object({
          toolName: Joi.string().required(),
          affiliateId: Joi.string().required(),
          network: Joi.string().required(),
          commission: Joi.number().min(0).max(100).required(),
        })
      ),
      status: Joi.string().valid('draft', 'published', 'archived'),
    }),
  }),

  update: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      title: Joi.string().max(200),
      content: Joi.string(),
      excerpt: Joi.string().max(500),
      category: Joi.array().items(Joi.string()),
      tags: Joi.array().items(Joi.string()),
      isPremium: Joi.boolean(),
      seo: Joi.object({
        metaTitle: Joi.string().max(60),
        metaDescription: Joi.string().max(160),
        canonicalUrl: Joi.string().uri(),
        keywords: Joi.array().items(Joi.string()),
      }),
      affiliateProducts: Joi.array().items(
        Joi.object({
          toolName: Joi.string().required(),
          affiliateId: Joi.string().required(),
          network: Joi.string().required(),
          commission: Joi.number().min(0).max(100).required(),
        })
      ),
      status: Joi.string().valid('draft', 'published', 'archived'),
    }),
  }),

  addTranslation: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      language: Joi.string().valid(...Object.values(LANGUAGES)).required(),
      title: Joi.string().max(200).required(),
      content: Joi.string().required(),
      excerpt: Joi.string().max(500).required(),
    }),
  }),

  updateAnalytics: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      views: Joi.number().min(0),
      uniqueVisitors: Joi.number().min(0),
      averageTimeOnPage: Joi.number().min(0),
      bounceRate: Joi.number().min(0).max(100),
      affiliateClicks: Joi.number().min(0),
      conversions: Joi.number().min(0),
      revenue: Joi.number().min(0),
    }),
  }),

  query: Joi.object({
    query: Joi.object({
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      category: Joi.string(),
      tag: Joi.string(),
      isPremium: Joi.boolean(),
      status: Joi.string().valid('draft', 'published', 'archived'),
      language: Joi.string().valid(...Object.values(LANGUAGES)),
      sort: Joi.string(),
      search: Joi.string(),
    }),
  }),
};
