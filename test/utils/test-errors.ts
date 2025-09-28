// test/utils/test-errors.ts
import { ValidationError } from "express-validator";

interface TestValidationError {
  name: string;
  message: string;
  statusCode: number;
  errors: ValidationError[];
}

export function createValidationError(
  message: string,
  errors: Array<{
    field: string;
    message: string;
    value?: unknown;
    location?: string;
  }> = [],
): TestValidationError {
  return {
    name: "ValidationError",
    message,
    statusCode: 400,
    errors: errors.map(
      (err) =>
        ({
          type: "field",
          msg: err.message,
          path: err.field,
          value: err.value ?? "",
          location: err.location ?? "body",
        }) as unknown as ValidationError,
    ),
  };
}
