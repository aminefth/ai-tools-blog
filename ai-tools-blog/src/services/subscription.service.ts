import { ISubscription, IUser } from '../@types/models';
import { Subscription, User } from '../models';
import { BaseService } from './base.service';
import { ApiError } from '../middleware/error.middleware';
import { Types } from 'mongoose';
type ObjectId = Types.ObjectId;
import { ERROR_CODES } from '../constants';
import { logger } from '../utils/logger';
import Stripe from 'stripe';
import { Paddle, Environment } from '@paddle/paddle-node-sdk';
import { appConfig } from '../config/app';

interface PlanConfig {
  name: string;
  price: number;
  features: string[];
  stripePriceId: string;
  paddlePlanId: string;
}

const SUBSCRIPTION_PLANS: Record<string, PlanConfig> = {
  BASIC: {
    name: 'Basic',
    price: 9.99,
    features: ['feature1', 'feature2'],
    stripePriceId: 'price_123',
    paddlePlanId: 'plan_123',
  },
  PRO: {
    name: 'Pro',
    price: 19.99,
    features: ['feature1', 'feature2', 'feature3'],
    stripePriceId: 'price_456',
    paddlePlanId: 'plan_456',
  },
  ENTERPRISE: {
    name: 'Enterprise',
    price: 49.99,
    features: ['feature1', 'feature2', 'feature3', 'feature4'],
    stripePriceId: 'price_789',
    paddlePlanId: 'plan_789',
  },
};

const stripe = new Stripe(appConfig.stripeSecretKey as string, {
  apiVersion: '2025-05-28.basil',
});

const paddle = new Paddle(appConfig.paddleApiKey as string, {
  environment: appConfig.env === 'production' ? 'live' as const : 'sandbox' as const,
});

export class SubscriptionService extends BaseService<ISubscription> {
  constructor() {
    super(Subscription);
  }

  async createSubscription(
    user: ISubscriptionUser,
    planConfig: ISubscriptionPlan,
    provider: SubscriptionProvider,
    paymentMethodId?: string
  ): Promise<ISubscription> {
    try {
      if (provider === 'stripe') {
        if (!planConfig.stripePriceId) {
          throw new ApiError(400, ERROR_CODES.INVALID_INPUT, 'Stripe price ID is required');
        }
        const customer = await this.getOrCreateStripeCustomer(user, paymentMethodId);
        const subscription = await stripe.subscriptions.create({
          customer: customer.id,
          items: [{ price: planConfig.stripePriceId }],
          payment_settings: {
            payment_method_types: ['card'],
            save_default_payment_method: 'on_subscription'
          },
          metadata: { userId: user._id.toString() }
        });

        return {
          userId: user._id,
          provider: 'stripe',
          planId: planConfig.stripePriceId,
          subscriptionId: subscription.id,
          status: subscription.status as SubscriptionStatus,
          currentPeriodEnd: new Date(subscription.current_period_end * 1000)
        };
      } else {
        if (!planConfig.paddlePlanId) {
          throw new ApiError(400, ERROR_CODES.INVALID_INPUT, 'Paddle plan ID is required');
        }
        const subscription = await paddle.subscriptions.create({
          customerId: user.email,
          planId: planConfig.paddlePlanId,
          customerEmail: user.email,
          customerName: user.name,
          customerCountry: user.profile?.country || 'US',
          metadata: { userId: user._id.toString() }
        });

        return {
          userId: user._id,
          provider: 'paddle',
          planId: planConfig.paddlePlanId,
          subscriptionId: subscription.id,
          status: subscription.status as SubscriptionStatus,
          currentPeriodEnd: new Date(subscription.nextBilledAt)
        };
      }
    } catch (error) {
      logger.error('Failed to create subscription:', error);
      throw new ApiError(
        error.status || 500,
        error.code || ERROR_CODES.INTERNAL_ERROR,
        error.message || 'Failed to create subscription'
      );
    }
  }

  async updateSubscription(
    subscriptionId: string,
    planId: string,
    provider: SubscriptionProvider
  ): Promise<ISubscription> {
    try {
      if (provider === 'stripe') {
        const subscription = await stripe.subscriptions.retrieve(subscriptionId);
        await stripe.subscriptions.update(subscriptionId, {
          items: [{
            id: subscription.items.data[0].id,
            price: planId
          }]
        });
        
        return this.findOneAndUpdate(
          { subscriptionId },
          { planId }
        );
      } else {
        await paddle.subscriptions.update(subscriptionId, {
          planId
        });
        
        return this.findOneAndUpdate(
          { subscriptionId },
          { planId }
        );
      }
    } catch (error) {
      logger.error('Failed to update subscription:', error);
      throw new ApiError(
        error.status || 500,
        error.code || ERROR_CODES.INTERNAL_ERROR,
        error.message || 'Failed to update subscription'
      );
    }
  }

  async cancelSubscription(subscriptionId: string, provider: SubscriptionProvider): Promise<void> {
    try {
      if (provider === 'stripe') {
        await stripe.subscriptions.cancel(subscriptionId);
      } else {
        await paddle.subscriptions.cancel(subscriptionId);
      }

      await this.updateSubscriptionStatus(
        subscriptionId,
        'canceled',
        new Date()
      );
    } catch (error) {
      logger.error('Failed to cancel subscription:', error);
      throw new ApiError(
        error.status || 500,
        error.code || ERROR_CODES.INTERNAL_ERROR,
        error.message || 'Failed to cancel subscription'
      );
    }
  }
  constructor() {
    super(Subscription);
  }

  async createSubscription(
    userId: Types.ObjectId,
    plan: 'basic' | 'pro' | 'enterprise',
    paymentMethod: 'stripe' | 'paddle',
    paymentMethodId?: string
  ): Promise<ISubscription> {
    try {
      const user = await User.findById(userId);
      if (!user) {
        throw new ApiError(404, ERROR_CODES.NOT_FOUND, 'User not found');
      }

      // Check if user already has an active subscription
      const existingSubscription = await this.findOne({
        userId,
        status: 'active',
      });

      if (existingSubscription) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'User already has an active subscription'
        );
      }

      const planConfig = SUBSCRIPTION_PLANS[plan];
      if (!planConfig) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid subscription plan'
        );
      }

      let subscriptionData: Partial<ISubscription>;

      if (paymentMethod === 'stripe') {
        subscriptionData = await this.createStripeSubscription(
          user,
          planConfig,
          paymentMethodId
        );
      } else {
        subscriptionData = await this.createPaddleSubscription(
          user,
          planConfig
        );
      }

      const subscription = await this.create({
        userId,
        plan,
        paymentMethod,
        status: 'active',
        ...subscriptionData,
      });

      // Update user's subscription status
      await User.findByIdAndUpdate(userId, {
        'subscription.isActive': true,
        'subscription.plan': plan,
        'subscription.expiresAt': subscriptionData.expiresAt,
      });

      return subscription;
    } catch (error) {
      logger.error('Subscription creation failed:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId: string): Promise<ISubscription> {
    try {
      const subscription = await this.findById(subscriptionId);
      
      if (subscription.status !== 'active') {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Subscription is not active'
        );
      }

      if (subscription.paymentMethod === 'stripe') {
        await stripe.subscriptions.cancel(subscription.externalId);
      } else {
        await paddle.subscription.cancel(subscription.externalId);
      }

      subscription.status = 'canceled';
      subscription.canceledAt = new Date();
      await subscription.save();

      // Update user's subscription status
      await User.findByIdAndUpdate(subscription.userId, {
        'subscription.isActive': false,
        'subscription.canceledAt': new Date(),
      });

      return subscription;
    } catch (error) {
      logger.error('Subscription cancellation failed:', error);
      throw error;
    }
  }

  async updateSubscriptionPlan(
    subscriptionId: string,
    newPlan: 'basic' | 'pro' | 'enterprise'
  ): Promise<ISubscription> {
    try {
      const subscription = await this.findById(subscriptionId);
      const planConfig = SUBSCRIPTION_PLANS[newPlan];

      if (!planConfig) {
        throw new ApiError(
          400,
          ERROR_CODES.VALIDATION_ERROR,
          'Invalid subscription plan'
        );
      }

      if (subscription.paymentMethod === 'stripe') {
        await stripe.subscriptions.update(subscription.externalId, {
          priceId: planConfig.stripePriceId,
        });
      } else {
        await paddle.subscription.updatePlan(
          subscription.externalId,
          planConfig.paddlePlanId
        );
      }

      subscription.plan = newPlan;
      await subscription.save();

      // Update user's subscription plan
      await User.findByIdAndUpdate(subscription.userId, {
        'subscription.plan': newPlan,
      });

      return subscription;
    } catch (error) {
      logger.error('Subscription plan update failed:', error);
      throw error;
    }
  }

  async handleWebhook(event: Stripe.Event | { type: string; data: { subscription_id: string; status: string; next_bill_date: string } }, provider: 'stripe' | 'paddle'): Promise<void> {
    try {
      if (provider === 'stripe') {
        await this.handleStripeWebhook(event as Stripe.Event);
      } else {
        await this.handlePaddleWebhook(event as { type: string; data: { subscription_id: string; status: string; next_bill_date: string } });
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
  }

  private async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionStatus(
          subscription.id,
          subscription.status as 'active' | 'canceled' | 'past_due',
          new Date(subscription.current_period_end * 1000)
        );
        break;
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await this.updateSubscriptionStatus(
            subscription.id,
            subscription.status as 'active' | 'canceled' | 'past_due',
            new Date(subscription.current_period_end * 1000)
          );
        }
        break;
      }
    }
  }

  private async handlePaddleWebhook(event: { type: string; data: { subscription_id: string; status: string; next_bill_date: string } }): Promise<void> {
    switch (event.type) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_cancelled': {
        const { subscription_id, status, next_bill_date } = event.data;
        await this.updateSubscriptionStatus(
          subscription_id,
          status as 'active' | 'canceled' | 'past_due',
          new Date(next_bill_date)
        );
        break;
      }
    }
  }
    try {
      if (provider === 'stripe') {
        await this.handleStripeWebhook(event as Stripe.Event);
      } else {
        await this.handlePaddleWebhook(event as { type: string; data: { subscription_id: string; status: string; next_bill_date: string } });
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      throw error;
    }
    if (provider === 'stripe') {
      await this.handleStripeWebhook(event as Stripe.Event);
    } else {
      await this.handlePaddleWebhook(event as { type: string; data: { subscription_id: string; status: string; next_bill_date: string } });
    }
  }
    try {
      if (provider === 'stripe') {
        await this.handleStripeWebhook(event as Stripe.Event);
      } else {
        await this.handlePaddleWebhook(event as { type: string; data: { subscription_id: string; status: string; next_bill_date: string } });
      }
    } catch (error) {
      logger.error('Webhook handling failed:', error);
      throw error;
    }
  }

  private async handlePaddleWebhook(event: { type: string; data: { subscription_id: string; status: string; next_bill_date: string } }): Promise<void> {
    switch (event.type) {
      case 'subscription_created':
      case 'subscription_updated':
      case 'subscription_cancelled': {
        const { subscription_id, status, next_bill_date } = event.data;
        await this.updateSubscriptionStatus(
          subscription_id,
          status as 'active' | 'canceled' | 'past_due',
          new Date(next_bill_date)
        );
        break;
      }
    }
  }
    const { subscription_id, status, next_bill_date } = event.data;
    
    switch (event.type) {
      case 'subscription.updated':
      case 'subscription.cancelled': {
        await this.updateSubscriptionStatus(
          subscription_id,
          status === 'active' ? 'active' as const : status === 'cancelled' ? 'canceled' as const : 'past_due' as const,
          new Date(next_bill_date)
        );
        break;
      }
      case 'subscription.payment_failed': {
        await this.updateSubscriptionStatus(
          subscription_id,
          'past_due' as const
        );
        break;
      }
    }
  }

  private async createStripeSubscription(
    user: { _id: Types.ObjectId; email: string; name: string; stripeCustomerId?: string },
    planConfig: { stripePriceId: string },
    paymentMethodId?: string
  ): Promise<Partial<ISubscription>> {
    const customer = await this.getOrCreateStripeCustomer(user, paymentMethodId);

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planConfig.stripePriceId }],
      payment_settings: {
        payment_method_types: ['card'],
        save_default_payment_method: 'on_subscription'
      },
      expand: ['latest_invoice.payment_intent']
    });

    return {
      userId: user._id,
      provider: 'stripe' as const,
      planId: planConfig.stripePriceId,
      subscriptionId: subscription.id,
      status: subscription.status === 'active' ? 'active' as const : 'past_due' as const,
      currentPeriodEnd: new Date(subscription.current_period_end * 1000)
    };
  }

  private async createPaddleSubscription(
    user: { _id: Types.ObjectId; email: string; name: string; profile?: { country: string } },
    planConfig: { paddlePlanId: string }
  ): Promise<Partial<ISubscription>> {
    const subscription = await paddle.subscriptions.create({
      customerId: user.email,
      planId: planConfig.paddlePlanId,
      customerEmail: user.email,
      customerName: user.name,
      customerCountry: user.profile?.country || 'US',
      metadata: { userId: user._id.toString() }
    });

    return {
      userId: user._id,
      provider: 'paddle' as const,
      planId: planConfig.paddlePlanId,
      subscriptionId: subscription.id,
      status: subscription.status === 'active' ? 'active' as const : 'past_due' as const,
      currentPeriodEnd: new Date(subscription.nextBilledAt)
    };
    const subscription = await paddle.subscriptions.create({
      customerId: user.email,
      planId: planConfig.paddlePlanId,
{{ ... }}
    } else {
      const customerData = await stripe.customers.create({
        metadata: { userId: user._id.toString() },
        email: user.email,
        payment_method: user.paymentMethodId,
        invoice_settings: {
          default_payment_method: user.paymentMethodId,
        },
      });
      customer = customerData as Stripe.Customer;

      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customer.id,
      });
    }

    return customer;
  }

  private async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionStatus(
          subscription.id,
          subscription.status as 'active' | 'canceled' | 'past_due',
          new Date(subscription.current_period_end * 1000)
        );
        break;
      }
      case 'invoice.payment_succeeded':
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          const subscription = await stripe.subscriptions.retrieve(invoice.subscription as string);
          await this.updateSubscriptionStatus(
            subscription.id,
            subscription.status as 'active' | 'canceled' | 'past_due',
            new Date(subscription.current_period_end * 1000)
          );
        }
        break;
      }
    }
  }
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionStatus(
          subscription.id,
          subscription.status === 'active' ? 'active' as const : subscription.status === 'canceled' ? 'canceled' as const : 'past_due' as const,
          new Date(subscription.current_period_end * 1000)
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await this.updateSubscriptionStatus(
            invoice.subscription as string,
            'past_due' as const
          );
        }
        break;
      }
    }

  await this.findOneAndUpdate(
    { subscriptionId },
    {
      status,
      currentPeriodEnd,
      ...(status === 'canceled' ? { canceledAt: new Date() } : {})
    }
    await subscription.save();

    // Update user's subscription status
    await User.findByIdAndUpdate(subscription.userId, {
      'subscription.isActive': status === 'active',
      'subscription.expiresAt': expiresAt,
    });
  }
}
