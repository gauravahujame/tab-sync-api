import { Request, Response, NextFunction } from "express";
import { errorHandler } from "../../../src/middlewares/errorHandler.js";
import { ValidationError as ExpressValidationErrorr } from "express-validator";
import { z } from "zod";

// Define minimal CustomError interface for tests
interface CustomError extends Error {
  statusCode?: number;
  errors?: ExpressValidationErrorr[];
  isOperational?: boolean;
}

describe("Error Handler Middleware", () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;
  let jsonMock: jest.Mock;
  let statusMock: jest.Mock;

  beforeEach(() => {
    jsonMock = jest.fn();
    statusMock = jest.fn().mockReturnThis();

    req = {
      method: "GET",
      originalUrl: "/test",
    };

    res = {
      status: statusMock,
      json: jsonMock,
    };

    next = jest.fn();

    // Mock console.error to keep test output clean
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it("should handle ValidationError from express-validator", () => {
    const error: CustomError = {
      name: "ValidationError",
      statusCode: 400,
      message: "Validation failed",
      errors: [
        {
          msg: "Invalid email",
          param: "email",
          location: "body",
          type: "field", // required properties added for casting
          path: ["email"],
        } as unknown as ExpressValidationErrorr,
        {
          msg: "Password is required",
          param: "password",
          location: "body",
          type: "field",
          path: ["password"],
        } as unknown as ExpressValidationErrorr,
      ],
    };

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Validation Error",
      details: [
        { field: "email", message: "Invalid email" },
        { field: "password", message: "Password is required" },
      ],
    });
  });

  it("should handle ZodError", () => {
    const error = z
      .object({
        email: z.string().email(),
        password: z.string().min(8),
      })
      .safeParse({
        email: "invalid-email",
        password: "short",
      });

    if (error.success) return; // This should never happen in this test

    errorHandler(error.error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(400);
    const response = jsonMock.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toBe("Validation Error");
    expect(Array.isArray(response.details)).toBe(true);
    expect(response.details.length).toBeGreaterThan(0);
  });

  it("should handle custom AppError", () => {
    const error = new Error("Custom error") as any;
    error.statusCode = 403;
    error.isOperational = true;

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(403);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Custom error",
    });
  });

  it("should handle JWT errors", () => {
    const error = new Error("Invalid token");
    error.name = "JsonWebTokenError";

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Invalid token",
    });
  });

  it("should handle JWT expiration error", () => {
    const error = new Error("Token expired");
    error.name = "TokenExpiredError";

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(401);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Token expired",
    });
  });

  it("should handle 404 errors", () => {
    const error = new Error("Not Found");
    (error as any).statusCode = 404;

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(404);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Not Found",
    });
  });

  it("should handle unknown errors in production", () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const error = new Error("Some unexpected error");

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);
    expect(jsonMock).toHaveBeenCalledWith({
      success: false,
      error: "Internal Server Error",
    });

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });

  it("should include stack trace in development", () => {
    // Save original NODE_ENV
    const originalNodeEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "development";

    const error = new Error("Some error");

    errorHandler(error, req as Request, res as Response, next);

    expect(statusMock).toHaveBeenCalledWith(500);

    const response = jsonMock.mock.calls[0][0];
    expect(response.success).toBe(false);
    expect(response.error).toBe("Some error");
    expect(response.stack).toBeDefined();

    // Restore NODE_ENV
    process.env.NODE_ENV = originalNodeEnv;
  });
});
