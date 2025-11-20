// ErrorHandler.js

// const appErrors = require('./appErrors');

// import AppError from "./appError";
// Global Error Handler Middleware

import { Response } from 'express';

// Custom Error Type
// interface AppError {
//   isOperational: boolean;
//   statusCode: number;
//   status: string;
//   message: string;
// }

// Error Handler Function
export const errorHandler = (err: any, res: Response) => {
  if (err.isOperational) {
    // Operational error, send defined status and message
    return res.status(err.statusCode).json({
      status: err.status,
      message: err.message,
    });
  }

  // Non-operational errors, log it and send a generic message
  console.error('ERROR 💥:', err);

  res.status(500).json({
    status: 'error',
    message: 'Something went very wrong!',
  });
};


module.exports = errorHandler;
