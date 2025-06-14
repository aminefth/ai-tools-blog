import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ApiError } from './error.middleware';
import { ERROR_CODES } from '../constants';
import { User } from '../models';
import { appConfig } from '../config/app';

export interface AuthRequest extends Request {
  user?: any;
}

export const protect = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    // Get token from header
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      throw new ApiError(
        401,
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Not authorized to access this route'
      );
    }

    // Verify token
    const decoded = jwt.verify(token, appConfig.jwtSecret as string) as any;

    // Get user from token
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      throw new ApiError(
        401,
        ERROR_CODES.AUTHENTICATION_ERROR,
        'User not found'
      );
    }

    // Check if subscription is active for premium routes
    if (req.path.includes('/premium') && !user.hasActiveSubscription()) {
      throw new ApiError(
        403,
        ERROR_CODES.AUTHORIZATION_ERROR,
        'Active subscription required'
      );
    }

    req.user = user;
    next();
  } catch (error) {
    if (error instanceof jwt.JsonWebTokenError) {
      throw new ApiError(
        401,
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Invalid token'
      );
    }
    next(error);
  }
};

export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      throw new ApiError(
        401,
        ERROR_CODES.AUTHENTICATION_ERROR,
        'Not authorized to access this route'
      );
    }

    if (!roles.includes(req.user.role)) {
      throw new ApiError(
        403,
        ERROR_CODES.AUTHORIZATION_ERROR,
        'Not authorized to access this route'
      );
    }
    next();
  };
};
