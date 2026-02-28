import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { getDb } from '../db.js';
import logger from '../utils/logger.js';

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
authRouter.get('/validate', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      valid: false,
      error: 'No token provided',
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret) as jwt.JwtPayload;

    // Return token information without sensitive data
    const { iat: _iat, exp, ...userInfo } = decoded;

    // Ensure the token contains necessary user information
    if (!userInfo.id) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid token format: missing user ID',
      });
    }

    // Check if user still exists in database
    try {
      const db = getDb();
      const user = await db.get<{ id: number; email: string; name: string }>(
        'SELECT id, email, name FROM users WHERE id = ? LIMIT 1',
        [userInfo.id],
      );

      if (!user) {
        logger.warn('[AUTH:VALIDATE] User not found', {
          userId: userInfo.id,
        });
        return res.status(401).json({
          valid: false,
          error: 'User not found or has been deleted',
        });
      }

      return res.json({
        valid: true,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          expiresIn: exp ? Math.floor(exp - Date.now() / 1000) + ' seconds' : 'never',
        },
      });
    } catch (dbErr) {
      logger.error('[AUTH:VALIDATE] Database error', {
        error: (dbErr as Error).message,
        userId: userInfo.id,
      });
      return res.status(500).json({
        valid: false,
        error: 'Database error',
      });
    }
  } catch (error) {
    let errorMessage = 'Invalid token';

    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token';
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

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user or update existing one
 *     description: Creates a new user with generated token, or updates token for existing user
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - email
 *               - name
 *               - browserName
 *             properties:
 *               email:
 *                 type: string
 *               name:
 *                 type: string
 *               browserName:
 *                 type: string
 *     responses:
 *       200:
 *         description: User registered successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 token:
 *                   type: string
 *                 user:
 *                   type: object
 *       400:
 *         description: Invalid input
 */
authRouter.post('/register', async (req, res) => {
  const { email, name, browserName } = req.body;

  if (!email || !name || !browserName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, name, browserName',
    });
  }

  try {
    const db = getDb();

    // Check if user exists
    const existingUser = await db.get<{ id: number; email: string; name: string }>(
      'SELECT id, email, name FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    let userId: number;

    if (existingUser) {
      userId = existingUser.id;
    } else {
      // Insert new user
      // Token will be updated after we get the ID
      const result = await db.run(
        'INSERT INTO users (name, email, token, browser_name) VALUES (?, ?, ?, ?)',
        [name, email, '', browserName],
      );
      if (!result.lastID) {
        throw new Error('Failed to create user');
      }
      userId = result.lastID;
    }

    // Generate JWT token
    // Payload matches what script/user-create.ts was doing
    const payload = {
      id: userId,
      name,
      email,
      browserName,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '365d', // 1 year expiration
    });

    // Update user with new token
    await db.run('UPDATE users SET token = ?, name = ?, browser_name = ? WHERE id = ?', [
      token,
      name,
      browserName,
      userId,
    ]);

    logger.info(`[AUTH:REGISTER] User registered: ${email} (ID: ${userId})`);

    res.json({
      success: true,
      token,
      user: {
        id: userId,
        email,
        name,
        browserName,
      },
    });
  } catch (error) {
    logger.error('[AUTH:REGISTER] Registration failed', {
      error: (error as Error).message,
      email,
    });
    res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

export default authRouter;
