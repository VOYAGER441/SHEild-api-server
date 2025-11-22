import { Request, Response, NextFunction } from 'express';

export const apiErrorHandler = (controllerMethod: Function, context?: any) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Bind context if provided, otherwise use the method as-is
      const boundMethod = context ? controllerMethod.bind(context) : controllerMethod;
      await Promise.resolve(boundMethod(req, res, next));
    } catch (error) {
      next(error);
    }
  };
};
