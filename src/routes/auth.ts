import express from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
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
 *       401:
 *         description: Invalid or missing token
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

    if (!userInfo.id) {
      return res.status(401).json({
        valid: false,
        error: 'Invalid token format: missing user ID',
      });
    }

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
 * /api/v1/auth/login:
 *   post:
 *     summary: Login an existing user
 *     description: Authenticates user and returns a JWT token
 */
authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, password',
    });
  }

  try {
    const db = getDb();

    // Check if user exists
    const user = await db.get<{ id: number; email: string; name: string; password_hash?: string; browser_name: string }>(
      'SELECT id, email, name, password_hash, browser_name FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    if (!user.password_hash) {
      // For backward compatibility: if there is no password_hash, reject login
      // until the admin sets a password.
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    const passwordMatches = await bcrypt.compare(password, user.password_hash);

    if (!passwordMatches) {
      return res.status(401).json({
        success: false,
        error: 'Invalid credentials',
      });
    }

    // Generate JWT token
    const payload = {
      id: user.id,
      name: user.name,
      email: user.email,
      browserName: user.browser_name,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '365d', // 1 year expiration
    });

    // Update user with new token
    await db.run('UPDATE users SET token = ? WHERE id = ?', [token, user.id]);

    logger.info(`[AUTH:LOGIN] User logged in: ${email} (ID: ${user.id})`);

    return res.json({
      success: true,
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        browserName: user.browser_name,
      },
    });
  } catch (error) {
    logger.error('[AUTH:LOGIN] Login failed', {
      error: (error as Error).message,
      email,
    });
    return res.status(500).json({
      success: false,
      error: 'Failed to login',
    });
  }
});

/**
 * @openapi
 * /api/v1/auth/register:
 *   post:
 *     summary: Register a new user
 *     description: Creates a new user with generated token and saves password
 */
authRouter.post('/register', async (req, res) => {
  const { email, name, password, browserName } = req.body;

  if (!email || !name || !password || !browserName) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: email, name, password, browserName',
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      error: 'Password must be at least 6 characters long',
    });
  }

  try {
    const db = getDb();

    // Check if user exists
    const existingUser = await db.get<{ id: number }>(
      'SELECT id FROM users WHERE email = ? LIMIT 1',
      [email],
    );

    if (existingUser) {
      return res.status(400).json({
        success: false,
        error: 'User is already registered with this email',
      });
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Insert new user
    const result = await db.run(
      'INSERT INTO users (name, email, token, password_hash, browser_name) VALUES (?, ?, ?, ?, ?)',
      [name, email, '', passwordHash, browserName],
    );

    if (!result.lastID) {
      throw new Error('Failed to create user');
    }
    const userId = result.lastID;

    // Generate JWT token
    const payload = {
      id: userId,
      name,
      email,
      browserName,
    };

    const token = jwt.sign(payload, config.jwtSecret, {
      expiresIn: '365d',
    });

    // Update user with new token
    await db.run('UPDATE users SET token = ? WHERE id = ?', [
      token,
      userId,
    ]);

    logger.info(`[AUTH:REGISTER] User registered: ${email} (ID: ${userId})`);

    return res.json({
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
    return res.status(500).json({
      success: false,
      error: 'Failed to register user',
    });
  }
});

export default authRouter;
