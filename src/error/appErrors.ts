// appErrors.js

const AppError = require('./AppError');

export  const appErrors = {
  // 400 - Bad Request
  badRequest: new AppError('Bad request', 400),

  // 401 - Unauthorized
  unauthorized: new AppError('Unauthorized access', 401),

  // 403 - Forbidden
  forbidden: new AppError('Forbidden. You do not have access to this resource.', 403),

  // 404 - Not Found
  notFound: new AppError('Resource not found', 404),

  // 409 - Conflict
  conflict: new AppError('Conflict: Duplicate resource or conflict with the current state of the resource.', 409),

  // 500 - Internal Server Error
  internalServerError: new AppError('Internal server error', 500),

  // 503 - Service Unavailable
  serviceUnavailable: new AppError('Service temporarily unavailable', 503),
};

module.exports = appErrors;
