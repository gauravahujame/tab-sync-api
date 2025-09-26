import type { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger.js';

interface CustomError extends Error {
  status?: number;
  code?: string;
  data?: any;
}

export function errorHandler(
  err: CustomError,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  // Log the error with request details
  logger.error({
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
    code: err.code || 'INTERNAL_ERROR'
  });

  // Determine status code
  const statusCode = err.status || 500;
  
  // Format the error response
  const errorResponse = {
    success: false,
    error: err.message || 'Internal Server Error',
    code: err.code,
    ...(err.data && { data: err.data })
  };

  res.status(statusCode).json(errorResponse);
}
