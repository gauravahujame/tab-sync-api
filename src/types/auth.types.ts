// Using any to avoid Express module resolution issues in tests
/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * User interface representing authenticated user data
 */
export interface User {
  id: number;
  name?: string;
  email?: string;
  [key: string]: any;
}

/**
 * JWT Payload interface for token decoding
 */
export interface JWTPayload {
  id: number;
  name?: string;
  email?: string;
  iat?: number;
  exp?: number;
  [key: string]: any;
}

/**
 * Request headers interface
 */
export interface RequestHeaders {
  authorization?: string;
  [key: string]: string | string[] | undefined;
}

/**
 * Basic Express Request interface for testing
 */
export interface BaseRequest {
  headers: RequestHeaders;
  path: string;
  method: string;
  url: string;
  query: any;
  params: any;
  body: any;
  cookies: any;
}

/**
 * Extended Express Request interface with authenticated user
 */
export interface AuthRequest extends BaseRequest {
  user?: User;
  instanceId?: string;
}

/**
 * Standard API Response interface
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

/**
 * Database User Row interface
 */
export interface UserRow {
  id: number;
  email: string;
  name?: string;
  token?: string;
  created_at: string;
}
