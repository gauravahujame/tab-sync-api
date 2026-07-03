import { beforeAll, afterAll, describe, it, expect } from '@jest/globals';
import { clearDatabase, createTestUser } from '../utils/test-utils.js';
import { createTestClient } from '../utils/test-client.js';

describe('Browsing History API', () => {
  const testUser = {
    email: 'history-test@example.com',
    name: 'History Test User',
    token: 'history-test-token',
    browserName: 'test-browser',
  };

  type TestClient = ReturnType<typeof createTestClient>;
  let client: TestClient;

  beforeAll(async () => {
    client = createTestClient(1, testUser.email, testUser.browserName);
    await createTestUser(testUser);
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe('POST /api/v1/history', () => {
    it('should create a new history entry', async () => {
      const response = await client.post('/api/v1/history').send({
        url: 'https://github.com/gauravahujame/tabsync',
        title: 'TabSync Repository',
        domain: 'github.com',
        tags: ['dev', 'self-hosted'],
      });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.entry).toHaveProperty('id');
      expect(response.body.entry.url).toBe('https://github.com/gauravahujame/tabsync');
      expect(response.body.entry.tags).toEqual(['dev', 'self-hosted']);
      expect(response.body.entry.visitCount).toBe(1);
    });

    it('should increment visit count for existing URLs', async () => {
      const url = 'https://example.com/repeated';

      await client.post('/api/v1/history').send({
        url,
        title: 'Repeated Visit',
        domain: 'example.com',
        tags: ['test'],
      });

      const response = await client.post('/api/v1/history').send({
        url,
        title: 'Repeated Visit Updated',
        domain: 'example.com',
        tags: ['test', 'updated'],
      });

      expect(response.status).toBe(201);
      expect(response.body.entry.visitCount).toBe(2);
      expect(response.body.entry.tags).toEqual(['test', 'updated']);
    });

    it('should reject invalid URLs', async () => {
      const response = await client.post('/api/v1/history').send({
        url: 'not-a-valid-url',
        title: 'Invalid',
        domain: 'example.com',
      });

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty('success', false);
    });
  });

  describe('GET /api/v1/history', () => {
    beforeAll(async () => {
      await client.post('/api/v1/history').send({
        url: 'https://docs.example.com/page1',
        title: 'Docs Page 1',
        domain: 'docs.example.com',
        tags: ['docs', 'work'],
      });

      await client.post('/api/v1/history').send({
        url: 'https://news.example.com/article',
        title: 'News Article',
        domain: 'news.example.com',
        tags: ['news', 'personal'],
      });
    });

    it('should list history entries', async () => {
      const response = await client.get('/api/v1/history');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body.entries.length).toBeGreaterThanOrEqual(3);
      expect(response.body).toHaveProperty('total');
    });

    it('should filter by tags', async () => {
      const response = await client.get('/api/v1/history?tags=work');

      expect(response.status).toBe(200);
      expect(response.body.entries.every((entry: any) => entry.tags.includes('work'))).toBe(true);
    });

    it('should filter by domain', async () => {
      const response = await client.get('/api/v1/history?domain=docs.example.com');

      expect(response.status).toBe(200);
      expect(response.body.entries.every((entry: any) => entry.domain === 'docs.example.com')).toBe(
        true,
      );
    });
  });

  describe('GET /api/v1/history/:entryId', () => {
    it('should return a single history entry', async () => {
      const createResponse = await client.post('/api/v1/history').send({
        url: 'https://unique.example.com/page',
        title: 'Unique Page',
        domain: 'unique.example.com',
        tags: ['unique'],
      });

      const entryId = createResponse.body.entry.id;
      const response = await client.get(`/api/v1/history/${entryId}`);

      expect(response.status).toBe(200);
      expect(response.body.entry.url).toBe('https://unique.example.com/page');
    });

    it('should return 404 for non-existent entries', async () => {
      const response = await client.get('/api/v1/history/99999');

      expect(response.status).toBe(404);
    });
  });

  describe('PUT /api/v1/history/:entryId', () => {
    it('should update history entry tags', async () => {
      const createResponse = await client.post('/api/v1/history').send({
        url: 'https://update.example.com/page',
        title: 'Update Page',
        domain: 'update.example.com',
        tags: ['old-tag'],
      });

      const entryId = createResponse.body.entry.id;
      const response = await client.put(`/api/v1/history/${entryId}`).send({
        tags: ['new-tag'],
      });

      expect(response.status).toBe(200);
      expect(response.body.entry.tags).toEqual(['new-tag']);
    });
  });

  describe('DELETE /api/v1/history/:entryId', () => {
    it('should delete a history entry', async () => {
      const createResponse = await client.post('/api/v1/history').send({
        url: 'https://delete.example.com/page',
        title: 'Delete Page',
        domain: 'delete.example.com',
        tags: ['delete'],
      });

      const entryId = createResponse.body.entry.id;
      const response = await client.delete(`/api/v1/history/${entryId}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);

      const getResponse = await client.get(`/api/v1/history/${entryId}`);
      expect(getResponse.status).toBe(404);
    });
  });

  describe('GET /api/v1/history/tags', () => {
    it('should return tag summary', async () => {
      const response = await client.get('/api/v1/history/tags');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('summary');
      expect(Object.keys(response.body.summary).length).toBeGreaterThan(0);
    });
  });

  describe('GET /api/v1/history/domains', () => {
    it('should return domain summary', async () => {
      const response = await client.get('/api/v1/history/domains');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('success', true);
      expect(response.body).toHaveProperty('summary');
    });
  });
});
