
export default class AppError extends Error {
    statusCode: number;
    status: string;
    isOperational: boolean;
    constructor(message: string | undefined, statusCode: number) {
      super(message);
      this.statusCode = statusCode || 500;
      this.status = `${statusCode}`.startsWith('4') ? 'fail' : 'error';
      this.isOperational = true; // Marks this as an operational error
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  module.exports = AppError;
  