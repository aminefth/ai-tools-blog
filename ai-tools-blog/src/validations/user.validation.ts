import Joi from 'joi';

export const userValidation = {
  register: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().min(8).required(),
      profile: Joi.object({
        name: Joi.string().required(),
        avatar: Joi.string().uri().optional(),
        bio: Joi.string().max(500).optional(),
      }).required(),
    }),
  }),

  login: Joi.object({
    body: Joi.object({
      email: Joi.string().email().required(),
      password: Joi.string().required(),
    }),
  }),

  updateProfile: Joi.object({
    body: Joi.object({
      profile: Joi.object({
        name: Joi.string().optional(),
        avatar: Joi.string().uri().optional(),
        bio: Joi.string().max(500).optional(),
      }),
    }),
  }),

  updateSubscription: Joi.object({
    body: Joi.object({
      plan: Joi.string().valid('basic', 'pro', 'enterprise').required(),
      paymentMethod: Joi.string().valid('stripe', 'paddle').required(),
      externalId: Joi.string().required(),
    }),
  }),

  updateAffiliateData: Joi.object({
    body: Joi.object({
      referralCode: Joi.string().optional(),
      earnings: Joi.number().min(0).optional(),
      clicks: Joi.number().min(0).optional(),
      conversions: Joi.number().min(0).optional(),
    }),
  }),
};
