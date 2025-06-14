import Joi from 'joi';
import { SUBSCRIPTION_PLANS } from '../constants';

export const subscriptionValidation = {
  create: Joi.object({
    body: Joi.object({
      plan: Joi.string()
        .valid(...Object.keys(SUBSCRIPTION_PLANS).map(p => p.toLowerCase()))
        .required(),
      paymentMethod: Joi.string().valid('stripe', 'paddle').required(),
      externalId: Joi.string().required(),
      price: Joi.number().required(),
      currency: Joi.string().default('EUR'),
      features: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          enabled: Joi.boolean().required(),
        })
      ),
    }),
  }),

  update: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      status: Joi.string().valid('active', 'canceled', 'past_due'),
      plan: Joi.string().valid(...Object.keys(SUBSCRIPTION_PLANS).map(p => p.toLowerCase())),
      expiresAt: Joi.date(),
      features: Joi.array().items(
        Joi.object({
          name: Joi.string().required(),
          enabled: Joi.boolean().required(),
        })
      ),
    }),
  }),

  addBillingRecord: Joi.object({
    params: Joi.object({
      id: Joi.string().required(),
    }),
    body: Joi.object({
      amount: Joi.number().required(),
      currency: Joi.string().required(),
      status: Joi.string().valid('succeeded', 'failed').required(),
      date: Joi.date().default(Date.now),
    }),
  }),

  query: Joi.object({
    query: Joi.object({
      userId: Joi.string(),
      status: Joi.string().valid('active', 'canceled', 'past_due'),
      plan: Joi.string().valid(...Object.keys(SUBSCRIPTION_PLANS).map(p => p.toLowerCase())),
      page: Joi.number().min(1),
      limit: Joi.number().min(1).max(100),
      sort: Joi.string(),
    }),
  }),
};
