import {
  beforeAll,
  afterEach,
  describe,
  it,
  expect,
  jest,
} from "@jest/globals";
import { db } from "../../../src/db";
import { mockDatabaseError } from "../../helpers/test.helpers";
import * as sqlite3 from "sqlite3";

// Test types
interface DbResult {
  lastID?: number;
  changes?: number;
}

interface UserRow {
  id: number;
  name: string;
  email: string;
}

// Type definitions for mock functions
type RunFunction = (sql: string, ...params: unknown[]) => sqlite3.Database;
type GetFunction = (sql: string, ...params: unknown[]) => sqlite3.Database;
type AllFunction = (sql: string, ...params: unknown[]) => sqlite3.Database;
type CloseFunction = (callback: (err: Error | null) => void) => void;

// Mock implementations
const mockRun = jest.fn(function (
  this: DbResult,
  sql: string,
  ...params: unknown[]
): sqlite3.Database {
  const callback = params[params.length - 1] as (err: Error | null) => void;

  if (sql.includes("CREATE TABLE") || sql.includes("CREATE INDEX")) {
    callback(null);
  } else if (sql === "INVALID SQL") {
    callback(new Error('SQLITE_ERROR: near "INVALID": syntax error'));
  } else {
    this.lastID = 1;
    this.changes = 1;
    callback(null);
  }
  return this as unknown as sqlite3.Database;
}) as unknown as RunFunction;

const mockGet = jest.fn(
  (sql: string, ...params: unknown[]): sqlite3.Database => {
    const callback = params[params.length - 1] as (
      err: Error | null,
      row?: UserRow,
    ) => void;

    if (sql === "INVALID SQL") {
      callback(new Error("SQLITE_ERROR: no such table: invalid"));
      return undefined as unknown as sqlite3.Database;
    }

    const row: UserRow = {
      id: 1,
      name: "Test User",
      email: "test@example.com",
    };
    callback(null, row);
    return undefined as unknown as sqlite3.Database;
  },
) as unknown as GetFunction;

const mockAll = jest.fn(
  (sql: string, ...params: unknown[]): sqlite3.Database => {
    const callback = params[params.length - 1] as (
      err: Error | null,
      rows?: UserRow[],
    ) => void;

    if (sql === "INVALID SQL") {
      callback(new Error("SQLITE_ERROR: no such table: invalid"));
      return undefined as unknown as sqlite3.Database;
    }

    const rows: UserRow[] = [
      { id: 1, name: "Test User 1", email: "test1@example.com" },
      { id: 2, name: "Test User 2", email: "test2@example.com" },
    ];
    callback(null, rows);
    return undefined as unknown as sqlite3.Database;
  },
) as unknown as AllFunction;

const mockClose: jest.MockedFunction<CloseFunction> = jest.fn((callback) => {
  callback(null);
});

// Mock the sqlite3 module
jest.mock("sqlite3", () => {
  // Create a mock database instance
  const mockDb = {
    run: mockRun as unknown as RunFunction,
    get: mockGet as unknown as GetFunction,
    all: mockAll as unknown as AllFunction,
    close: mockClose as unknown as CloseFunction,
  };

  // Add mock implementation methods to the mock functions
  (mockDb.run as jest.Mock).mockImplementation(mockRun as unknown as jest.Mock);
  (mockDb.get as jest.Mock).mockImplementation(mockGet as unknown as jest.Mock);
  (mockDb.all as jest.Mock).mockImplementation(mockAll as unknown as jest.Mock);

  return {
    Database: jest.fn().mockImplementation(() => mockDb),
  };
});

describe("Database Module", () => {
  beforeAll(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("Database Initialization", () => {
    it("should initialize the database with required tables", () => {
      // The tables should be created when the db module is imported
      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS users"),
        expect.any(Function),
      );

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_users_email"),
        expect.any(Function),
      );

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("CREATE TABLE IF NOT EXISTS tabs"),
        expect.any(Function),
      );

      expect(db.run).toHaveBeenCalledWith(
        expect.stringContaining("CREATE INDEX IF NOT EXISTS idx_tabs_user_id"),
        expect.any(Function),
      );
    });
  });

  describe("Database Operations", () => {
    it("should execute run queries", (done) => {
      const query = "INSERT INTO users (name, email) VALUES (?, ?)";
      const params = ["Test User", "test@example.com"];

      db.run(query, params, function (err) {
        expect(err).toBeNull();
        expect(this.lastID).toBe(1);
        expect(this.changes).toBe(1);
        done();
      });
    });

    it("should execute get queries", (done) => {
      const query = "SELECT * FROM users WHERE id = ?";
      const params = [1];

      db.get(query, params, (err, row) => {
        expect(err).toBeNull();
        expect(row).toEqual({
          id: 1,
          name: "Test User",
          email: "test@example.com",
        });
        done();
      });
    });

    it("should execute all queries", (done) => {
      const query = "SELECT * FROM users";

      db.all(query, [], (err, rows) => {
        expect(err).toBeNull();
        expect(rows).toHaveLength(2);
        expect(rows[0]).toHaveProperty("id");
        expect(rows[0]).toHaveProperty("name");
        done();
      });
    });
  });

  describe("Error Handling", () => {
    it("should handle database errors in run", (done) => {
      const error = mockDatabaseError("Run failed");

      // Override the mock to return an error
      (db.get as jest.Mock).mockImplementationOnce((query, ...args) => {
        const callback = args[args.length - 1] as (err: Error | null) => void;
        callback(error);
        return { lastID: 1, changes: 1 } as unknown;
      });

      db.run("INVALID SQL", [], (err) => {
        expect(err).toBe(error);
        done();
      });
    });

    it("should handle database errors in get", (done) => {
      const error = mockDatabaseError("Get failed");

      // Override the mock to return an error
      (db.get as jest.Mock).mockImplementationOnce((query, ...args) => {
        const callback = args[args.length - 1] as (
          err: Error | null,
          row?: UserRow,
        ) => void;
        callback(error, undefined);
        return { lastID: 1, changes: 1 } as unknown;
      });

      db.get("INVALID SQL", [], (err, row) => {
        expect(err).toBe(error);
        expect(row).toBeUndefined();
        done();
      });
    });

    it("should handle database errors in all", (done) => {
      const error = mockDatabaseError("All failed");

      // Override the mock to return an error
      (db.get as jest.Mock).mockImplementationOnce((query, ...args) => {
        const callback = args[args.length - 1] as (
          err: Error | null,
          rows?: UserRow[],
        ) => void;
        callback(error, undefined);
        return { lastID: 1, changes: 1 } as unknown;
      });

      db.all("INVALID SQL", [], (err, rows) => {
        expect(err).toBe(error);
        expect(rows).toBeUndefined();
        done();
      });
    });
  });

  describe("Database Connection", () => {
    it("should close the database connection", (done) => {
      // Reset the mock implementation for this test
      mockClose.mockImplementationOnce((callback) => callback(null));

      // Close the database
      db.close((err) => {
        expect(err).toBeNull();
        expect(mockClose).toHaveBeenCalled();
        done();
      });
    });

    it("should handle errors when closing the database", (done) => {
      const error = new Error("Failed to close database");

      // Set up the mock to call back with an error
      mockClose.mockImplementationOnce((callback) => callback(error));

      // Close the database
      db.close((err) => {
        expect(err).toBe(error);
        done();
      });
    });
  });
});
