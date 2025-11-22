import { Request, Response, NextFunction } from 'express';
import { AppError } from './AppError';

export const globalErrorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (err.isOperational) {
    res.status(err.statusCode || 500).json({
      status: err.status || 'error',
      message: err.message,
      statusCode: err.statusCode
    });
    return;
  }

  console.error('ERROR 💥:', err);

  res.status(500).json({
    status: 'error',
    message: 'Something went very wrong!',
    statusCode: 500
  });
};
