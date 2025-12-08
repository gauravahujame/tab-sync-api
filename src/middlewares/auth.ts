import { NextFunction, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db.js";
import { AuthRequest, JWTPayload } from "../types/index.js";
import logger from "../utils/logger.js";

export async function authMiddleware(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
) {
  // Skip auth for public endpoints
  const publicPaths = [
    "/api/v1/health",
    "/api/v1/auth/validate", // This endpoint handles its own auth logic
  ];

  if (publicPaths.includes(req.path)) {
    return next();
  }

  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Please provide a valid Bearer token.",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);

    // Ensure decoded token has required user information
    const decodedUser = decoded as JWTPayload;

    if (!decodedUser.id) {
      return res.status(401).json({
        success: false,
        error: "Invalid token format: missing user ID",
      });
    }

    // âœ" Check if user still exists in database
    return new Promise<void>((resolve) => {
      db.get(
        'SELECT id, email, name FROM users WHERE id = ? LIMIT 1',
        [decodedUser.id],
        (err, user: any) => {
          if (err) {
            logger.error('[AUTH:MIDDLEWARE] Database error', {
              error: err.message,
              userId: decodedUser.id,
            });
            res.status(500).json({
              success: false,
              error: "Authentication failed",
            });
            return resolve();
          }

          if (!user) {
            logger.warn(
              '[AUTH:MIDDLEWARE] User deleted but token still valid',
              {
                userId: decodedUser.id,
              },
            );
            res.status(401).json({
              success: false,
              error: "User not found or has been deleted",
            });
            return resolve();
          }

          // âœ" User exists, attach to request
          req.user = {
            id: user.id,
            email: user.email,
            name: user.name,
          };

          logger.debug('[AUTH:MIDDLEWARE] User authenticated', {
            userId: user.id,
          });

          next();
          resolve();
        },
      );
    });
  } catch (error) {
    let errorMessage = "Invalid token";

    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = "Token has expired";
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = "Invalid token signature";
    }

    return res.status(401).json({
      success: false,
      error: errorMessage,
    });
  }
}
