import express from "express";
import jwt from "jsonwebtoken";
import { config } from "../config.js";
import { db } from "../db.js";
import logger from "../utils/logger.js";

export const authRouter = express.Router();

/**
 * @openapi
 * /api/v1/auth/validate:
 *   get:
 *     summary: Validate an API key (JWT token)
 *     description: Verify if the provided API key is valid and return token information
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Token is valid
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                 user:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: string
 *                     email:
 *                       type: string
 *                     role:
 *                       type: string
 *       401:
 *         description: Invalid or missing token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 valid:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Invalid or expired token"
 */
authRouter.get("/validate", async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      valid: false,
      error: "No token provided",
    });
  }

  const token = authHeader.split(" ")[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;

    // Return token information without sensitive data
    const { iat, exp, ...userInfo } = decoded;

    // Ensure the token contains necessary user information
    if (!userInfo.id) {
      return res.status(401).json({
        valid: false,
        error: "Invalid token format: missing user ID",
      });
    }

    // âœ" NEW: Check if user still exists in database
    return new Promise<void>((resolve) => {
      db.get(
        'SELECT id, email, name FROM users WHERE id = ? LIMIT 1',
        [userInfo.id],
        (err: any, user: any) => {
          if (err) {
            logger.error('[AUTH:VALIDATE] Database error', {
              error: err.message,
              userId: userInfo.id,
            });
            res.status(500).json({
              valid: false,
              error: "Database error",
            });
            return resolve();
          }

          if (!user) {
            logger.warn('[AUTH:VALIDATE] User not found', {
              userId: userInfo.id,
            });
            res.status(401).json({
              valid: false,
              error: "User not found or has been deleted",
            });
            return resolve();
          }

          res.json({
            valid: true,
            user: {
              id: user.id,
              email: user.email,
              name: user.name,
              expiresIn: exp
                ? Math.floor(exp - Date.now() / 1000) + " seconds"
                : "never",
            },
          });
          resolve();
        },
      );
    });
  } catch (error) {
    let errorMessage = "Invalid token";

    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = "Token has expired";
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = "Invalid token";
    }

    logger.warn('[AUTH:VALIDATE] Token verification failed', {
      error: errorMessage,
    });

    return res.status(401).json({
      valid: false,
      error: errorMessage,
    });
  }
});

export default authRouter;
