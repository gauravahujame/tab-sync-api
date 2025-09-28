import { Response, NextFunction } from "express";
import { AuthRequest } from "../../src/types/index.js";

/**
 * Mock factory for creating AuthRequest objects in tests
 */
export const createMockAuthRequest = (
  headers: Record<string, string> = {},
  user?: AuthRequest["user"],
): AuthRequest => {
  const mockReq = {
    headers: {
      authorization: "",
      ...headers,
    },
    user,
    // Mock other Request properties as needed
    method: "GET",
    url: "/",
    path: "/",
    query: {},
    params: {},
    body: {},
    cookies: {},
    get: jest.fn(),
    header: jest.fn(),
    accepts: jest.fn(),
    acceptsCharsets: jest.fn(),
    acceptsEncodings: jest.fn(),
    acceptsLanguages: jest.fn(),
    is: jest.fn(),
    param: jest.fn(),
    range: jest.fn(),
    fresh: false,
    stale: true,
    xhr: false,
    ip: "127.0.0.1",
    ips: [],
    protocol: "http",
    secure: false,
    subdomains: [],
    originalUrl: "/",
    baseUrl: "",
    app: {} as any,
    res: {} as any,
    next: {} as any,
    route: {} as any,
    httpVersion: "1.1",
    httpVersionMajor: 1,
    httpVersionMinor: 1,
    connection: {} as any,
    socket: {} as any,
    statusCode: undefined,
    statusMessage: undefined,
    readable: true,
    readableHighWaterMark: 16384,
    readableLength: 0,
    destroyed: false,
    complete: true,
    rawHeaders: [],
    rawTrailers: [],
    joinDuplicateHeaders: false,
    aborted: false,
  } as AuthRequest;

  return mockReq;
};

/**
 * Mock factory for creating Response objects in tests
 */
export const createMockResponse = (): Response => {
  const res: Partial<Response> = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
    setHeader: jest.fn().mockReturnThis(),
    getHeader: jest.fn(),
    cookie: jest.fn().mockReturnThis(),
    clearCookie: jest.fn().mockReturnThis(),
    redirect: jest.fn().mockReturnThis(),
    render: jest.fn().mockReturnThis(),
    end: jest.fn().mockReturnThis(),
  };
  return res as Response;
};

/**
 * Mock NextFunction for tests
 */
export const createMockNext = (): NextFunction => jest.fn() as NextFunction;
