import Joi from 'joi';

export const analyticsValidation = {
  create: Joi.object({
    body: Joi.object({
      date: Joi.date().required(),
      revenue: Joi.object({
        total: Joi.number().min(0).required(),
        affiliate: Joi.number().min(0).required(),
        subscriptions: Joi.number().min(0).required(),
        sponsored: Joi.number().min(0).required(),
        currency: Joi.string().default('EUR'),
      }).required(),
      traffic: Joi.object({
        pageViews: Joi.number().min(0).required(),
        uniqueVisitors: Joi.number().min(0).required(),
        averageSessionDuration: Joi.number().min(0).required(),
        bounceRate: Joi.number().min(0).max(100).required(),
      }).required(),
      conversions: Joi.object({
        affiliateClicks: Joi.number().min(0).required(),
        affiliateConversions: Joi.number().min(0).required(),
        subscriptionSignups: Joi.number().min(0).required(),
        conversionRate: Joi.number().min(0).max(100).required(),
      }).required(),
      content: Joi.object({
        totalPosts: Joi.number().min(0).required(),
        premiumPosts: Joi.number().min(0).required(),
        topPerformingPosts: Joi.array().items(
          Joi.object({
            postId: Joi.string().required(),
            views: Joi.number().min(0).required(),
            revenue: Joi.number().min(0).required(),
          })
        ).max(10),
      }).required(),
    }),
  }),

  update: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      revenue: Joi.object({
        total: Joi.number().min(0),
        affiliate: Joi.number().min(0),
        subscriptions: Joi.number().min(0),
        sponsored: Joi.number().min(0),
      }),
      traffic: Joi.object({
        pageViews: Joi.number().min(0),
        uniqueVisitors: Joi.number().min(0),
        averageSessionDuration: Joi.number().min(0),
        bounceRate: Joi.number().min(0).max(100),
      }),
      conversions: Joi.object({
        affiliateClicks: Joi.number().min(0),
        affiliateConversions: Joi.number().min(0),
        subscriptionSignups: Joi.number().min(0),
        conversionRate: Joi.number().min(0).max(100),
      }),
      content: Joi.object({
        totalPosts: Joi.number().min(0),
        premiumPosts: Joi.number().min(0),
        topPerformingPosts: Joi.array().items(
          Joi.object({
            postId: Joi.string().required(),
            views: Joi.number().min(0).required(),
            revenue: Joi.number().min(0).required(),
          })
        ).max(10),
      }),
    }),
  }),

  query: Joi.object({
    query: Joi.object({
      startDate: Joi.date(),
      endDate: Joi.date(),
      metrics: Joi.array().items(
        Joi.string().valid(
          'revenue',
          'traffic',
          'conversions',
          'content'
        )
      ),
      groupBy: Joi.string().valid('day', 'week', 'month', 'year'),
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
    }),
  }),
};
