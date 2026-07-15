import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import bcrypt from 'bcryptjs';
import { clearDatabase, createTestUser, runAsync } from '../utils/test-utils.js';
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
  let userId: number;

  beforeAll(async () => {
    // Optionally create the test user in the database if needed
    userId = await createTestUser(testUser);
    // Create the test client with the user's actual database id
    client = createTestClient(userId, testUser.email, testUser.browserName);
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('GET /api/v1/auth/validate', () => {
    it('should validate a valid token', async () => {
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

  describe('POST /api/v1/auth/login', () => {
    const loginUser = {
      email: 'login-test@example.com',
      name: 'Login Test User',
      token: 'login-token',
      browserName: 'login-browser',
    };
    beforeAll(async () => {
      await createTestUser(loginUser);
    });

    it('should be accessible without authentication', async () => {
      const passwordHash = await bcrypt.hash('password123', 10);
      await runAsync('UPDATE users SET password_hash = ? WHERE email = ?', [
        passwordHash,
        loginUser.email,
      ]);

      const response = await client.unauthenticated
        .post('/api/v1/auth/login')
        .send({ email: loginUser.email, password: 'password123' });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', loginUser.email);
    });

    it('should reject invalid credentials', async () => {
      const response = await client.unauthenticated
        .post('/api/v1/auth/login')
        .send({ email: testUser.email, password: 'wrong-password' });

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('Admin routes', () => {
    it('should require authentication', async () => {
      const response = await client.unauthenticated.get('/api/v1/admin/users');

      expect(response.status).toBe(401);
      expect(response.body).toHaveProperty('success', false);
    });

    it('should be accessible with valid authentication', async () => {
      const response = await client.get('/api/v1/admin/users');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('users');
    });
  });
});
