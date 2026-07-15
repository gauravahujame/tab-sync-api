import { describe, it, expect, jest, beforeEach, beforeAll, afterAll } from '@jest/globals';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/middlewares/auth.js';
import { AuthRequest } from '../../../src/types/index.js';
import { Response, NextFunction } from 'express';
import { clearDatabase, createTestUser, generateTestToken } from '../../utils/test-utils.js';
import { config } from '../../../src/config.js';

describe('Authentication Middleware', () => {
  let req: AuthRequest;
  let res: Response;
  let next: NextFunction;
  let validUserId: number;

  beforeAll(async () => {
    validUserId = await createTestUser({
      email: 'test@example.com',
      name: 'Test User',
      token: 'some-token',
      browserName: 'test-browser',
    });
  });

  afterAll(async () => {
    await clearDatabase();
  });

  beforeEach(() => {
    jest.clearAllMocks();

    // Simple mock request
    req = {
      path: '/',
      headers: {
        authorization: '',
      },
      user: undefined,
    } as AuthRequest;

    // Simple mock response
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    } as any;

    next = jest.fn() as NextFunction;
  });

  it('should allow access to public endpoints without token', async () => {
    req.path = '/api/v1/health';
    req.headers.authorization = '';

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should return 401 when no authorization header', async () => {
    req.headers.authorization = '';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when authorization header doesn't start with Bearer", async () => {
    req.headers.authorization = 'Basic sometoken';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Authentication required. Please provide a valid Bearer token.',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 for invalid token', async () => {
    const verifySpy = jest.spyOn(jwt, 'verify').mockImplementation(() => {
      throw new Error('Invalid token');
    });

    req.headers.authorization = 'Bearer invalid.token';

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid token',
    });
    expect(next).not.toHaveBeenCalled();

    verifySpy.mockRestore();
  });

  it('should return 401 when token is missing user ID', async () => {
    const tokenWithoutId = jwt.sign({ email: 'test@example.com' }, config.jwtSecret);

    req.headers.authorization = `Bearer ${tokenWithoutId}`;

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: 'Invalid token format: missing user ID',
    });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() with valid token', async () => {
    const validToken = generateTestToken(validUserId, 'test@example.com', 'test-browser');

    req.headers.authorization = `Bearer ${validToken}`;

    await authMiddleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: validUserId,
      email: 'test@example.com',
      name: 'Test User',
    });
  });
});
