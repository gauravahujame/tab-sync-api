import { Request, Response, NextFunction } from "express";
import { testConfig } from "../config/test.config";

/**
 * Create a mock Express request object
 */
export const mockRequest = (
  options: Partial<Request> = {},
): Partial<Request> => {
  const req = {
    body: {},
    params: {},
    query: {},
    headers: {},
    cookies: {},
    user: null,
    ...options,
  };
  return req as Partial<Request>;
};

/**
 * Create a mock Express response object
 */
export const mockResponse = (): Partial<Response> => {
  const res: Partial<Response> = {};

  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  res.send = jest.fn().mockReturnValue(res);
  res.sendStatus = jest.fn().mockReturnValue(res);
  res.redirect = jest.fn().mockReturnValue(res);
  res.setHeader = jest.fn().mockReturnValue(res);
  res.clearCookie = jest.fn().mockReturnValue(res);
  res.cookie = jest.fn().mockReturnValue(res);

  return res;
};

/**
 * Create a mock Express next function
 */
export const mockNext = (): jest.Mock<NextFunction> => {
  return jest.fn() as unknown as jest.Mock<NextFunction>;
};

/**
 * Create a test user with valid JWT token
 */
export const createTestUser = (overrides = {}) => ({
  ...testConfig.testUser,
  ...overrides,
});

/**
 * Create test tabs
 */
export const createTestTabs = (userId = 1, count = 2) => {
  return Array.from({ length: count }, (_, i) => ({
    ...testConfig.testTabs[i % testConfig.testTabs.length],
    id: i + 1,
    user_id: userId,
  }));
};

/**
 * Mock database responses
 */
export const mockDbResponses = {
  getUserById: (user = testConfig.testUser) => ({
    id: user.id,
    email: user.email,
    name: user.name,
    token: user.token,
  }),

  getTabsByUserId: (userId = 1, count = 2) => {
    return createTestTabs(userId, count);
  },

  getTabById: (tabId = 1, userId = 1) => {
    return {
      ...testConfig.testTabs[0],
      id: tabId,
      user_id: userId,
    };
  },
};

/**
 * Mock JWT tokens
 */
export const mockJwt = {
  sign: (payload: unknown) => `mocked-jwt-token.${JSON.stringify(payload)}`,

  verify: (token: string) => {
    if (!token || !token.startsWith("mocked-jwt-token")) {
      throw new Error("Invalid token");
    }

    try {
      const payload = JSON.parse(token.split(".")[1]);
      return payload;
    } catch (e: unknown) {
      throw new Error("Invalid token payload", { cause: e });
    }
  },
};

/**
 * Wait for a specified number of milliseconds
 */
export const wait = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Mock database error
 */
export const mockDatabaseError = (error = "Database error") => {
  const err = new Error(error);
  (err as unknown as { code: string }).code = "SQLITE_ERROR";
  return err;
};
