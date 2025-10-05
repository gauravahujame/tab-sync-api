import supertest from "supertest";
import { app } from "../../src/index.js";
import { generateTestToken } from "./test-utils.js";

/**
 * Creates a test client with authentication
 */
export const createTestClient = (
  userId: number = 1,
  email: string = "test@example.com",
  browserName: string = "test-browser",
) => {
  const token = generateTestToken(userId, email, browserName);
  const request = supertest(app);

  return {
    get: (url: string) =>
      request.get(url).set("Authorization", `Bearer ${token}`),

    post: (url: string) =>
      request.post(url).set("Authorization", `Bearer ${token}`),

    put: (url: string) =>
      request.put(url).set("Authorization", `Bearer ${token}`),

    delete: (url: string) =>
      request.delete(url).set("Authorization", `Bearer ${token}`),

    // For unauthenticated requests
    unauthenticated: {
      get: (url: string) => request.get(url),
      post: (url: string) => request.post(url),
      put: (url: string) => request.put(url),
      delete: (url: string) => request.delete(url),
    },
  };
};
