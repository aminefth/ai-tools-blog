import Joi from 'joi';
import { AFFILIATE_NETWORKS } from '../constants';

export const affiliateValidation = {
  createClick: Joi.object({
    body: Joi.object({
      blogPostId: Joi.string().required(),
      toolName: Joi.string().required(),
      affiliateNetwork: Joi.string()
        .valid(...Object.values(AFFILIATE_NETWORKS))
        .required(),
      trackingData: Joi.object({
        ip: Joi.string().ip().required(),
        userAgent: Joi.string().required(),
        referrer: Joi.string().uri().optional(),
        utmSource: Joi.string().optional(),
        utmMedium: Joi.string().optional(),
        utmCampaign: Joi.string().optional(),
      }).required(),
    }),
  }),

  updateClick: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      converted: Joi.boolean().required(),
      conversionValue: Joi.when('converted', {
        is: true,
        then: Joi.number().min(0).required(),
        otherwise: Joi.forbidden(),
      }),
      convertedAt: Joi.when('converted', {
        is: true,
        then: Joi.date().default(Date.now),
        otherwise: Joi.forbidden(),
      }),
    }),
  }),

  query: Joi.object({
    query: Joi.object({
      userId: Joi.string(),
      blogPostId: Joi.string(),
      toolName: Joi.string(),
      affiliateNetwork: Joi.string().valid(...Object.values(AFFILIATE_NETWORKS)),
      converted: Joi.boolean(),
      startDate: Joi.date(),
      endDate: Joi.date(),
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      sort: Joi.string(),
    }),
  }),

  stats: Joi.object({
    query: Joi.object({
      toolName: Joi.string(),
      affiliateNetwork: Joi.string().valid(...Object.values(AFFILIATE_NETWORKS)),
      startDate: Joi.date(),
      endDate: Joi.date(),
      groupBy: Joi.string().valid('day', 'week', 'month', 'year'),
    }),
  }),
};
