import { NextFunction, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db.js';
import { AuthRequest, JWTPayload } from '../types/index.js';
import logger from '../utils/logger.js';

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction) {
  // Skip auth for public endpoints
  const publicPaths = ['/api/v1/health'];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    const decodedUser = decoded as JWTPayload;

    if (!decodedUser.id) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format: missing user ID',
      });
    }

    const db = getDb();
    const user = await db.get<{
      id: number;
      email: string;
      name: string;
      token: string | null;
      token_revoked_at: number | null;
    }>('SELECT id, email, name, token, token_revoked_at FROM users WHERE id = ? LIMIT 1', [
      decodedUser.id,
    ]);

    if (!user) {
      logger.warn('[AUTH:MIDDLEWARE] User deleted but token still valid', {
        userId: decodedUser.id,
      });
      return res.status(401).json({
        success: false,
        error: 'User not found or has been deleted',
      });
    }

    // Reject tokens issued before a revocation event (e.g. "log out everywhere"
    // or password change). This allows multiple valid devices to remain signed in
    // while still supporting explicit revocation.
    const revokedAt = user.token_revoked_at || 0;
    const issuedAt =
      typeof decoded === 'object' && (decoded as jwt.JwtPayload).iat
        ? (decoded as jwt.JwtPayload).iat
        : 0;

    if (!user.token || (revokedAt > 0 && issuedAt <= revokedAt)) {
      logger.warn('[AUTH:MIDDLEWARE] Token mismatch or revoked', {
        userId: user.id,
      });
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked. Please log in again.',
      });
    }

    req.user = {
      id: user.id,
      email: user.email,
      name: user.name,
    };

    logger.debug('[AUTH:MIDDLEWARE] User authenticated', {
      userId: user.id,
    });

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
      error: errorMessage,
    });
  }
}
