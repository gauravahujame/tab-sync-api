import { describe, it, expect, jest, beforeEach } from "@jest/globals";
import jwt from "jsonwebtoken";
import { authMiddleware } from "../../../src/middlewares/auth";
import { AuthRequest } from "../../../src/types/index";
import { Response, NextFunction } from "express";

// Mock JWT verify
jest.mock("jsonwebtoken");

describe("Authentication Middleware", () => {
  let req: AuthRequest;
  let res: Response;
  let next: NextFunction;

  beforeEach(() => {
    jest.clearAllMocks();

    // Simple mock request
    req = {
      path: "/",
      headers: {
        authorization: "",
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

  it("should allow access to public endpoints without token", async () => {
    req.path = "/api/v1/health";
    req.headers.authorization = "";

    await authMiddleware(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it("should return 401 when no authorization header", async () => {
    req.headers.authorization = "";

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Authentication required. Please provide a valid Bearer token.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when authorization header doesn't start with Bearer", async () => {
    req.headers.authorization = "Basic sometoken";

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Authentication required. Please provide a valid Bearer token.",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 for invalid token", async () => {
    (jwt.verify as jest.Mock).mockImplementation(() => {
      throw new Error("Invalid token");
    });

    req.headers.authorization = "Bearer invalid.token";

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token signature",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 when token is missing user ID", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      email: "test@example.com",
      // missing id
    });

    req.headers.authorization = "Bearer valid.token.without.id";

    await authMiddleware(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token format: missing user ID",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should call next() with valid token", async () => {
    (jwt.verify as jest.Mock).mockReturnValue({
      id: 1,
      email: "test@example.com",
      name: "Test User",
    });

    req.headers.authorization = "Bearer valid.token.here";

    await authMiddleware(req, res, next);

    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 1,
      email: "test@example.com",
      name: "Test User",
    });
  });
});
