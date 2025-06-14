import { ISubscription, IUser } from '../@types/models';
import { Subscription, User } from '../models';
import { BaseService } from './base.service';
import { ApiError } from '../middleware/error.middleware';
import { ERROR_CODES, SUBSCRIPTION_PLANS } from '../constants';
import { logger } from '../utils/logger';
import Stripe from 'stripe';
import { PaddleSDK } from '@paddle/paddle-node-sdk';
import { appConfig } from '../config/app';

const stripe = new Stripe(appConfig.stripeSecretKey as string, {
  apiVersion: '2023-10-16',
});

const paddle = new PaddleSDK({
  apiKey: appConfig.paddleApiKey as string,
  environment: appConfig.nodeEnv === 'production' ? 'production' : 'sandbox',
});

export class SubscriptionService extends BaseService<ISubscription> {
  constructor() {
    super(Subscription);
  }

  async createSubscription(
    userId: string,
    plan: string,
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

      const planConfig = SUBSCRIPTION_PLANS[plan.toUpperCase()];
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
    newPlan: string
  ): Promise<ISubscription> {
    try {
      const subscription = await this.findById(subscriptionId);
      const planConfig = SUBSCRIPTION_PLANS[newPlan.toUpperCase()];

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

  async handleWebhook(
    provider: 'stripe' | 'paddle',
    event: any
  ): Promise<void> {
    try {
      if (provider === 'stripe') {
        await this.handleStripeWebhook(event);
      } else {
        await this.handlePaddleWebhook(event);
      }
    } catch (error) {
      logger.error('Webhook handling failed:', error);
      throw error;
    }
  }

  private async createStripeSubscription(
    user: IUser,
    planConfig: any,
    paymentMethodId?: string
  ): Promise<Partial<ISubscription>> {
    if (!paymentMethodId) {
      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        'Payment method ID is required for Stripe'
      );
    }

    const customer = await this.getOrCreateStripeCustomer(user, paymentMethodId);

    const subscription = await stripe.subscriptions.create({
      customer: customer.id,
      items: [{ price: planConfig.stripePriceId }],
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    });

    return {
      externalId: subscription.id,
      status: subscription.status === 'active' ? 'active' : 'pending',
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
    };
  }

  private async createPaddleSubscription(
    user: IUser,
    planConfig: any
  ): Promise<Partial<ISubscription>> {
    const subscription = await paddle.subscription.create({
      customerId: user.email,
      planId: planConfig.paddlePlanId,
      customerEmail: user.email,
      customerCountry: user.profile?.country || 'US',
    });

    return {
      externalId: subscription.id,
      status: 'active',
      currentPeriodEnd: new Date(subscription.nextBillDate),
      cancelAtPeriodEnd: false,
    };
  }

  private async getOrCreateStripeCustomer(
    user: IUser,
    paymentMethodId: string
  ): Promise<Stripe.Customer> {
    let customer: Stripe.Customer;

    if (user.stripeCustomerId) {
      customer = await stripe.customers.retrieve(
        user.stripeCustomerId
      ) as Stripe.Customer;
    } else {
      customer = await stripe.customers.create({
        email: user.email,
        payment_method: paymentMethodId,
        invoice_settings: {
          default_payment_method: paymentMethodId,
        },
        metadata: {
          userId: user._id.toString(),
        },
      });

      await User.findByIdAndUpdate(user._id, {
        stripeCustomerId: customer.id,
      });
    }

    return customer;
  }

  private async handleStripeWebhook(event: Stripe.Event): Promise<void> {
    switch (event.type) {
      case 'customer.subscription.updated':
      case 'customer.subscription.deleted': {
        const subscription = event.data.object as Stripe.Subscription;
        await this.updateSubscriptionStatus(
          subscription.id,
          subscription.status === 'active' ? 'active' : 'canceled',
          new Date(subscription.current_period_end * 1000)
        );
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (invoice.subscription) {
          await this.updateSubscriptionStatus(
            invoice.subscription as string,
            'past_due'
          );
        }
        break;
      }
    }
  }

  private async handlePaddleWebhook(event: any): Promise<void> {
    switch (event.alert_name) {
      case 'subscription_updated':
      case 'subscription_cancelled': {
        await this.updateSubscriptionStatus(
          event.subscription_id,
          event.status === 'active' ? 'active' : 'canceled',
          new Date(event.next_bill_date)
        );
        break;
      }
      case 'subscription_payment_failed': {
        await this.updateSubscriptionStatus(
          event.subscription_id,
          'past_due'
        );
        break;
      }
    }
  }

  private async updateSubscriptionStatus(
    externalId: string,
    status: string,
    expiresAt?: Date
  ): Promise<void> {
    const subscription = await this.findOne({ externalId });
    if (!subscription) return;

    subscription.status = status;
    if (expiresAt) {
      subscription.currentPeriodEnd = expiresAt;
    }
    await subscription.save();

    // Update user's subscription status
    await User.findByIdAndUpdate(subscription.userId, {
      'subscription.isActive': status === 'active',
      'subscription.expiresAt': expiresAt,
    });
  }
}
