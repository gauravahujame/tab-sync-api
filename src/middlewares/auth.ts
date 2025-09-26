import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

export interface AuthRequest extends Request {
  user?: {
    id: number;
    name?: string;
    email?: string;
    [key: string]: any;
  };
}

export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Skip auth for public endpoints
  const publicPaths = [
    '/api/v1/health',
    '/api/v1/auth/validate' // This endpoint handles its own auth logic
  ];
  
  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.'
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Ensure decoded token has required user information
    const decodedUser = decoded as { id?: number, name?: string, email?: string, [key: string]: any };
    
    if (!decodedUser.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format: missing user ID'
      });
    }
    
    req.user = {
      id: decodedUser.id,
      name: decodedUser.name,
      email: decodedUser.email
    };
    
    next();
  } catch (error) {
    let errorMessage = 'Invalid token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token signature';
    }
    
    return res.status(401).json({
      success: false,
      error: errorMessage
    });
  }
}
