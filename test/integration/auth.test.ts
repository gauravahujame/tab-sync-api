import { beforeAll, afterAll, describe, it, expect, jest } from '@jest/globals';
import { clearDatabase, createTestUser } from '../utils/test-utils.js';
import { createTestClient } from '../utils/test-client.js';

describe('Authentication API', () => {
  const testUser = {
    email: 'test@example.com',
    name: 'Test User',
    token: 'test-token-123',
    browserName: 'test-browser',
  };

  // Declare client variable at the suite level
  type TestClient = ReturnType<typeof createTestClient>;
  let client: TestClient;

  beforeAll(async () => {
    // Create the test client with the test user's email
    client = createTestClient(1, testUser.email, testUser.browserName);
    // Optionally create the test user in the database if needed
    await createTestUser(testUser);
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/auth/validate', () => {
    it('should validate a valid token', async () => {
      const client = createTestClient(1, testUser.email);

      const response = await client.get('/api/v1/auth/validate');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('valid', true);
      expect(response.body.user).toHaveProperty('email', testUser.email);
    });

    it('should reject requests without a token', async () => {
      const response = await client.unauthenticated.get('/api/v1/auth/validate');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('valid', false);
      expect(response.body).toHaveProperty('error');
    });

    it('should reject invalid tokens', async () => {
      const response = await client
        .get('/api/v1/auth/validate')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('valid', false);
    });
  });
});
