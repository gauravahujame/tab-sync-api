import { Response, NextFunction } from "express";
import { authMiddleware, AuthRequest } from "../../../src/middlewares/auth";
import {
  mockRequest,
  mockResponse,
  mockNext,
} from "../../helpers/test.helpers";
import { db } from "../../../src/db";

jest.mock("jsonwebtoken", () => ({
  verify: jest.fn((token, secret, callback) => {
    if (token === "valid.token.123") {
      callback(null, { userId: 1, email: "test@example.com" });
    } else {
      callback(new Error("Invalid token"), null);
    }
  }),
}));

// Mock database
jest.mock("../../../src/db", () => ({
  db: {
    get: jest.fn((query, params, callback) => {
      if (params[0] === 1) {
        callback(null, { id: 1, email: "test@example.com", name: "Test User" });
      } else {
        callback(null, null);
      }
    }),
  },
}));

describe("Authentication Middleware", () => {
  let req: Partial<AuthRequest>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create fresh mocks for each test
    req = mockRequest();
    res = mockResponse();
    next = mockNext();
  });

  it("should call next() with valid token", async () => {
    // Arrange
    req.headers = {
      authorization: "Bearer valid.token.123",
    };

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
    expect(req.user).toEqual({
      id: 1,
      email: "test@example.com",
      name: "Test User",
    });
  });

  it("should return 401 if no token is provided", async () => {
    // Arrange
    req.headers = {};

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "No token provided",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token is invalid", async () => {
    // Arrange
    req.headers = {
      authorization: "Bearer invalid.token",
    };

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if token format is invalid", async () => {
    // Arrange
    req.headers = {
      authorization: "InvalidFormat",
    };

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token format",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should return 401 if user not found", async () => {
    // Arrange
    req.headers = {
      authorization: "Bearer valid.token.123",
    };

    // Mock database to return no user
    (db.get as jest.Mock).mockImplementationOnce((query, params, callback) => {
      callback(null, null);
    });

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "User not found",
    });
    expect(next).not.toHaveBeenCalled();
  });

  it("should handle database errors", async () => {
    // Arrange
    req.headers = {
      authorization: "Bearer valid.token.123",
    };
    // Mock database to return an error
    const dbError = new Error("Database error");
    (db.get as jest.Mock).mockImplementationOnce((query, params, callback) => {
      callback(dbError, null);
    });

    // Act
    await authMiddleware(req as AuthRequest, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal server error",
    });
    expect(next).not.toHaveBeenCalled();
  });
});
