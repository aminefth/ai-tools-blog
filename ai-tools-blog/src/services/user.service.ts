import { IUser } from '../@types/models';
import { User } from '../models';
import { BaseService } from './base.service';
import { ApiError } from '../middleware/error.middleware';
import { ERROR_CODES } from '../constants';
import jwt from 'jsonwebtoken';
import { appConfig } from '../config/app';
import { logger } from '../utils/logger';

export class UserService extends BaseService<IUser> {
  constructor() {
    super(User);
  }

  async register(userData: Partial<IUser>): Promise<{ user: IUser; token: string }> {
    try {
      // Check if user already exists
      const existingUser = await this.findOne({ email: userData.email });
      if (existingUser) {
        throw new ApiError(400, ERROR_CODES.VALIDATION_ERROR, 'Email already registered');
      }

      // Create user
      const user = await this.create(userData);

      // Generate token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      logger.error('User registration failed:', error);
      throw error;
    }
  }

  async login(email: string, password: string): Promise<{ user: IUser; token: string }> {
    try {
      // Find user
      const user = await this.findOne({ email });
      if (!user) {
        throw new ApiError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Invalid credentials');
      }

      // Check password
      const isPasswordValid = await user.comparePassword(password);
      if (!isPasswordValid) {
        throw new ApiError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Invalid credentials');
      }

      // Generate token
      const token = this.generateToken(user);

      return { user, token };
    } catch (error) {
      logger.error('User login failed:', error);
      throw error;
    }
  }

  async updateSubscription(
    userId: string,
    subscriptionData: IUser['subscription']
  ): Promise<IUser> {
    try {
      const user = await this.update(
        userId,
        { subscription: subscriptionData },
        { new: true }
      );

      // Clear user cache
      // TODO: Implement cache clearing

      return user;
    } catch (error) {
      logger.error('Subscription update failed:', error);
      throw error;
    }
  }

  async updateAffiliateStats(
    userId: string,
    clickIncrement = 0,
    conversionIncrement = 0,
    earningsIncrement = 0
  ): Promise<IUser> {
    try {
      const user = await this.findById(userId);
      await user.updateAffiliateStats(
        clickIncrement,
        conversionIncrement,
        earningsIncrement
      );

      // Clear user cache
      // TODO: Implement cache clearing

      return user;
    } catch (error) {
      logger.error('Affiliate stats update failed:', error);
      throw error;
    }
  }

  async getAffiliateStats(userId: string): Promise<{
    clicks: number;
    conversions: number;
    earnings: number;
    conversionRate: number;
  }> {
    try {
      const user = await this.findById(userId);
      const { clicks, conversions, earnings } = user.affiliateData;

      return {
        clicks,
        conversions,
        earnings,
        conversionRate: clicks > 0 ? (conversions / clicks) * 100 : 0,
      };
    } catch (error) {
      logger.error('Get affiliate stats failed:', error);
      throw error;
    }
  }

  private generateToken(user: IUser): string {
    return jwt.sign(
      {
        id: user._id,
        email: user.email,
        role: user.role,
      },
      appConfig.jwtSecret as string,
      {
        expiresIn: appConfig.jwtExpiresIn,
      }
    );
  }

  async generateRefreshToken(user: IUser): Promise<string> {
    return jwt.sign(
      {
        id: user._id,
        tokenVersion: user.tokenVersion,
      },
      appConfig.jwtRefreshSecret as string,
      {
        expiresIn: appConfig.jwtRefreshExpiresIn,
      }
    );
  }

  async refreshToken(refreshToken: string): Promise<{ token: string; user: IUser }> {
    try {
      const decoded = jwt.verify(
        refreshToken,
        appConfig.jwtRefreshSecret as string
      ) as any;

      const user = await this.findById(decoded.id);

      // Check if token version matches
      if (user.tokenVersion !== decoded.tokenVersion) {
        throw new ApiError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Invalid refresh token');
      }

      const token = this.generateToken(user);

      return { token, user };
    } catch (error) {
      logger.error('Token refresh failed:', error);
      throw new ApiError(401, ERROR_CODES.AUTHENTICATION_ERROR, 'Invalid refresh token');
    }
  }
}
