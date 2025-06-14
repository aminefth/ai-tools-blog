import { Request, Response, NextFunction } from 'express';
import { Schema } from 'joi';
import { ApiError } from './error.middleware';
import { ERROR_CODES } from '../constants';

export const validate = (schema: Schema) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const validationResult = schema.validate(
      {
        body: req.body,
        query: req.query,
        params: req.params,
      },
      { abortEarly: false }
    );

    if (validationResult.error) {
      const errorMessage = validationResult.error.details
        .map((detail) => detail.message)
        .join(', ');

      throw new ApiError(
        400,
        ERROR_CODES.VALIDATION_ERROR,
        errorMessage
      );
    }

    Object.assign(req, validationResult.value);
    return next();
  };
};
