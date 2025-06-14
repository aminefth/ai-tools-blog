import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { ERROR_CODES } from '../constants';

export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public isOperational = true,
  ) {
    super(message);
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

export const errorHandler = (
  err: Error,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  next: NextFunction
) => {
  if (err instanceof ApiError) {
    logger.warn({
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      path: req.path,
      method: req.method,
    });

    return res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.message,
      },
    });
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    logger.warn({
      message: 'Validation Error',
      error: err,
      path: req.path,
      method: req.method,
    });

    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: err.message,
      },
    });
  }

  // MongoDB duplicate key error
  if (err.name === 'MongoError' && (err as any).code === 11000) {
    logger.warn({
      message: 'Duplicate Key Error',
      error: err,
      path: req.path,
      method: req.method,
    });

    return res.status(400).json({
      success: false,
      error: {
        code: ERROR_CODES.VALIDATION_ERROR,
        message: 'Duplicate value entered',
      },
    });
  }

  // Log unexpected errors
  logger.error({
    message: 'Unexpected Error',
    error: err,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });

  return res.status(500).json({
    success: false,
    error: {
      code: ERROR_CODES.SERVER_ERROR,
      message: 'An unexpected error occurred',
    },
  });
};
