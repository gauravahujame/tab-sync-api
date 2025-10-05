import { config } from "dotenv";
import { dirname, resolve } from "path";
import process from "process";
import { fileURLToPath } from "url";

// Load environment variables from .env.test file
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({
  path: resolve(__dirname, "../.env.test"),
  debug: false,
  quiet: true,
});

// Set test environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:"; // Use in-memory database for tests
process.env.JWT_SECRET = "test-secret";
process.env.PORT = "3000";

// Mock console methods to keep test output clean
const originalConsole = { ...console };

beforeAll(() => {
  // Mock console methods
  global.console = {
    ...originalConsole,
    log: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  };
});

afterAll(() => {
  // Restore original console
  global.console = originalConsole;
});
