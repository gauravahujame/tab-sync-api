import { beforeAll, afterAll, describe, it, expect, jest } from "@jest/globals";
import { clearDatabase, createTestUser } from "../utils/test-utils.js";
import { createTestClient } from "../utils/test-client.js";

// Mock the database for auth tests
jest.mock("../../src/db.js", () => {
  const mockDb = {
    run: jest.fn(),
    get: jest.fn(),
    all: jest.fn(),
  };
  return { db: mockDb };
});

describe("Authentication API", () => {
  const testUser = {
    email: "test@example.com",
    name: "Test User",
    token: "test-token-123",
  };

  // Declare client variable at the suite level
  let client;

  beforeAll(async () => {
    // Create the test client with the test user's email
    client = createTestClient(1, testUser.email);
    // Optionally create the test user in the database if needed
    await createTestUser(testUser);
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe("GET /api/v1/auth/validate", () => {
    it("should validate a valid token", async () => {
      const client = createTestClient(1, testUser.email);

      const response = await client.get("/api/v1/auth/validate");

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("valid", true);
      expect(response.body.user).toHaveProperty("email", testUser.email);
    });

    it("should reject requests without a token", async () => {
      const response = await client.unauthenticated.get(
        "/api/v1/auth/validate",
      );

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("valid", false);
      expect(response.body).toHaveProperty("error");
    });

    it("should reject invalid tokens", async () => {
      const response = await client
        .get("/api/v1/auth/validate")
        .set("Authorization", "Bearer invalid-token");

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("valid", false);
    });
  });

  describe("POST /api/v1/auth/login", () => {
    it("should authenticate with valid credentials", async () => {
      const response = await client.unauthenticated
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          token: testUser.token,
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("token");
      expect(response.body).toHaveProperty("user");
      expect(response.body.user.email).toBe(testUser.email);
    });

    it("should reject invalid credentials", async () => {
      const response = await client.unauthenticated
        .post("/api/v1/auth/login")
        .send({
          email: testUser.email,
          token: "wrong-password",
        });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty("error");
    });
  });
});
