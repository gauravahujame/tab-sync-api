import { Request, Response, NextFunction } from "express";
import { ValidationError as ExpressValidationError } from "express-validator";
import { ZodError, ZodIssue } from "zod";

// Define a custom error interface that may include statusCode, errors, and isOperational
export interface CustomError extends Error {
  statusCode?: number;
  isOperational?: boolean;
  errors?: ExpressValidationError[];
}

// Use `void` as return type because Express middleware handlers don't return anything meaningful
export function errorHandler(
  err: CustomError | ZodError<any>,
  _req: Request, // Mark unused variables with underscore prefix to avoid ESLint warnings
  res: Response,
  _next: NextFunction,
): void {
  console.error(err.stack);

  // Guard access to statusCode only if err is CustomError (not ZodError)
  const statusCode =
    "statusCode" in err && typeof err.statusCode === "number"
      ? err.statusCode
      : 500;

  // Handle express-validator ValidationError
  if (
    err.name === "ValidationError" &&
    Array.isArray((err as CustomError).errors)
  ) {
    res.status(400);
    // Map errors to expected format, cast to give access to param/msg safely
    const details = (err as CustomError).errors!.map(
      (error: ExpressValidationError) => ({
        field: (error as any).param,
        message: error.msg,
      }),
    );
    res.json({
      success: false,
      error: "Validation Error",
      details,
    });
    return;
  }

  // Handle ZodError
  if (err instanceof ZodError) {
    // ZodError has an `issues` property containing issues, each with path and message
    const details = err.issues.map((issue: ZodIssue) => ({
      field: issue.path.join("."),
      message: issue.message,
    }));
    res.status(400);
    res.json({
      success: false,
      error: "Validation Error",
      details,
    });
    return;
  }

  // Handle JWT errors
  if (err.name === "JsonWebTokenError") {
    res.status(401).json({
      success: false,
      error: err.message || "Invalid token",
    });
    return;
  }

  if (err.name === "TokenExpiredError") {
    res.status(401).json({
      success: false,
      error: err.message || "Token expired",
    });
    return;
  }

  // Handle operational or expected errors with statusCode
  if (err.isOperational) {
    res.status(statusCode).json({
      success: false,
      error: err.message,
    });
    return;
  }

  // Handle 404 specifically
  if (statusCode === 404) {
    res.status(404).json({
      success: false,
      error: err.message || "Not Found",
    });
    return;
  }

  // Handle unexpected errors differently by environment
  if (process.env.NODE_ENV === "production") {
    res.status(500).json({
      success: false,
      error: "Internal Server Error",
    });
    return;
  }

  // In development, include full error message and stack trace
  res.status(statusCode).json({
    success: false,
    error: err.message || "Internal Server Error",
    stack: err.stack,
  });
}
