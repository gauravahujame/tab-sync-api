import { Request, Response, NextFunction } from "express";
import {
  CustomError,
  errorHandler,
} from "../../../src/middlewares/errorHandler";
import { mockRequest, mockResponse } from "../../helpers/test.helpers";
import { ValidationError } from "express-validator";

describe("Error Handling Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: jest.Mock<NextFunction>;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create fresh mocks for each test
    req = mockRequest();
    res = mockResponse();
    next = jest.fn();

    // Mock console.error to prevent test output
    console.error = jest.fn();
  });

  it("should handle ValidationError from express-validator", () => {
    // Arrange
    const error = {
      name: "ValidationError",
      statusCode: 400,
      errors: [
        {
          type: "field",
          value: "invalid-email",
          msg: "Invalid email",
          path: "email",
          location: "body",
        } as ValidationError,
      ],
    };

    // Act
    errorHandler(error as CustomError, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Validation Error",
      details: [{ field: "email", message: "Invalid email" }],
    });
  });

  it("should handle custom AppError with status code", () => {
    // Arrange
    const error = new Error("Custom error") as any;
    error.statusCode = 403;
    error.isOperational = true;

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Custom error",
    });
  });

  it("should handle JWT errors", () => {
    // Arrange
    const error = new Error("Invalid token");
    error.name = "JsonWebTokenError";

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token",
    });
  });

  it("should handle JWT expiration error", () => {
    // Arrange
    const error = new Error("Token expired");
    error.name = "TokenExpiredError";

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Token expired",
    });
  });

  it("should handle 404 errors", () => {
    // Arrange
    const error = new Error("Not Found") as any;
    error.statusCode = 404;

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Not Found",
    });
  });

  it("should handle unknown errors in production", () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = new Error("Some unexpected error");

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      success: false,
      error: "Internal Server Error",
    });

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should include stack trace in development", () => {
    // Arrange
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const error = new Error("Some error");

    // Act
    errorHandler(error, req as Request, res as Response, next);

    // Get the response that was sent
    const response = (res.json as jest.Mock).mock.calls[0][0];

    // Assert
    expect(res.status).toHaveBeenCalledWith(500);
    expect(response.success).toBe(false);
    expect(response.error).toBe("Some error");
    expect(response.stack).toBeDefined();

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});
