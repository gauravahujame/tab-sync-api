/**
 * Test configuration
 * This file contains configuration and utilities for testing
 */

// Mock environment variables
process.env.NODE_ENV = "test";
process.env.DATABASE_PATH = ":memory:";
process.env.JWT_SECRET = "test-secret";
process.env.PORT = "0"; // Use random port for tests

// Mock logger to prevent console output during tests
jest.mock("../src/utils/logger", () => ({
  error: jest.fn(),
  warn: jest.fn(),
  info: jest.fn(),
  debug: jest.fn(),
  verbose: jest.fn(),
  silly: jest.fn(),
}));

// Mock database connection
jest.mock("../src/db", () => {
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn(),
  };

  // Mock the database connection
  return {
    db: mockDb,
    // Add any other exports from db.ts
  };
});

// Mock JWT
jest.mock("jsonwebtoken", () => ({
  sign: jest.fn(() => "mocked-jwt-token"),
  verify: jest.fn(),
}));

// Mock Express app
jest.mock("express", () => {
  const express = () => ({
    use: jest.fn(),
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
    delete: jest.fn(),
    listen: jest.fn((port, callback) => {
      if (callback) callback();
      return { close: jest.fn() };
    }),
  });

  express.json = jest.fn();
  express.urlencoded = jest.fn();

  return express;
});

// Mock SQLite3
jest.mock("sqlite3", () => ({
  Database: jest.fn().mockImplementation(() => ({
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
    close: jest.fn(),
  })),
  cached: {
    Database: jest.fn().mockImplementation(() => ({
      run: jest.fn(),
      get: jest.fn(),
      all: jest.fn(),
      close: jest.fn(),
    })),
  },
}));

// Mock file system
jest.mock("fs", () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn().mockReturnValue("mocked file content"),
  writeFileSync: jest.fn(),
  promises: {
    readFile: jest.fn().mockResolvedValue("mocked file content"),
    writeFile: jest.fn().mockResolvedValue(undefined),
  },
}));

// Mock path
jest.mock("path", () => ({
  join: jest.fn((...args) => args.join("/")),
  dirname: jest.fn((path) => path.split("/").slice(0, -1).join("/") || "/"),
  resolve: jest.fn((...args) => args.join("/")),
  basename: jest.fn((path) => path.split("/").pop() || ""),
  extname: jest.fn(() => ".js"),
}));

// Mock console to prevent test output
const consoleError = console.error;
const consoleWarn = console.warn;
const consoleLog = console.log;

beforeAll(() => {
  // Suppress console output during tests
  console.error = jest.fn();
  console.warn = jest.fn();
  console.log = jest.fn();
});

afterAll(() => {
  // Restore console
  console.error = consoleError;
  console.warn = consoleWarn;
  console.log = consoleLog;
});

// Global test timeout
jest.setTimeout(30000); // 30 seconds

// Export test configuration
export const testConfig = {
  testUser: {
    id: 1,
    email: "test@example.com",
    name: "Test User",
    token: "test-token-123",
  },
  testTabs: [
    {
      id: 1,
      url: "https://example.com/1",
      title: "Example 1",
      windowId: 1,
      client_tab_id: 1001,
      last_accessed: Date.now(),
      incognito: false,
      group_id: -1,
      browser_name: "test-browser",
      user_id: 1,
    },
    {
      id: 2,
      url: "https://example.com/2",
      title: "Example 2",
      windowId: 1,
      client_tab_id: 1002,
      last_accessed: Date.now(),
      incognito: false,
      group_id: -1,
      browser_name: "test-browser",
      user_id: 1,
    },
  ],
};
