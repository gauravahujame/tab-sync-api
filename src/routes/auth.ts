import express from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';

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
authRouter.get('/validate', (req, res) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ 
      valid: false, 
      error: 'No token provided' 
    });
  }

  const token = authHeader.split(' ')[1];
  
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    
    // Return token information without sensitive data
    const { iat, exp, ...user } = decoded as jwt.JwtPayload;
    
    // Ensure the token contains necessary user information
    if (!user.id) {
      return res.status(401).json({ 
        valid: false, 
        error: 'Invalid token format: missing user ID' 
      });
    }
    
    res.json({
      valid: true,
      user: {
        id: user.id,
        name: user.name || '',
        email: user.email || '',
        expiresIn: exp ? Math.floor(exp - Date.now() / 1000) + ' seconds' : 'never'
      }
    });
  } catch (error) {
    let errorMessage = 'Invalid token';
    
    if (error instanceof jwt.TokenExpiredError) {
      errorMessage = 'Token has expired';
    } else if (error instanceof jwt.JsonWebTokenError) {
      errorMessage = 'Invalid token';
    }
    
    return res.status(401).json({ 
      valid: false, 
      error: errorMessage 
    });
  }
});

export default authRouter;
