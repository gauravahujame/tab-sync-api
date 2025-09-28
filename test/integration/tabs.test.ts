import { beforeAll, afterAll, describe, it, expect } from "@jest/globals";
import {
  clearDatabase,
  createTestUser,
  createTestTabs,
} from "../utils/test-utils.js";
import { createTestClient } from "../utils/test-client.js";
import { db } from "../../src/db.js";
import { promisify } from "util";

const getAsync = promisify(db.get.bind(db));

describe("Tabs API", () => {
  let testUserId: number;
  // let testToken: string;
  const testUser = {
    email: "tabs-test@example.com",
    name: "Tabs Test User",
    token: "test-token-456",
  };

  beforeAll(async () => {
    // Create a test user
    testUserId = await createTestUser(testUser);
    testToken = `test-token-${testUserId}`;
  });

  afterAll(async () => {
    await clearDatabase();
  });

  describe("POST /api/v1/tabs", () => {
    it("should create a new tab", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const tabData = {
        url: "https://example.com",
        title: "Example Domain",
        windowId: 1,
        client_tab_id: 1001,
        last_accessed: Date.now(),
        incognito: false,
        group_id: -1,
        browser_name: "test-browser",
      };

      const response = await client.post("/api/v1/tabs").send(tabData);

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty("id");
      expect(response.body.url).toBe(tabData.url);
      expect(response.body.user_id).toBe(testUserId);
    });

    it("should validate tab data", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const invalidTabData = {
        // Missing required url field
        title: "Invalid Tab",
        windowId: "not-a-number",
      };

      const response = await client.post("/api/v1/tabs").send(invalidTabData);

      expect(response.status).toBe(400);
      expect(response.body).toHaveProperty("error");
      expect(response.body.details).toBeDefined();
    });
  });

  describe("POST /api/v1/tabs/batch", () => {
    it("should create multiple tabs in a batch", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const batchData = {
        tabs: [
          {
            url: "https://example.com/1",
            title: "Example 1",
            windowId: 1,
          },
          {
            url: "https://example.com/2",
            title: "Example 2",
            windowId: 1,
          },
        ],
      };

      const response = await client.post("/api/v1/tabs/batch").send(batchData);

      expect(response.status).toBe(201);
      expect(Array.isArray(response.body.ids)).toBe(true);
      expect(response.body.ids).toHaveLength(2);
      expect(response.body.stats).toHaveProperty("created", 2);
    });

    it("should handle duplicates in batch", async () => {
      const client = createTestClient(testUserId, testUser.email);

      // First create a tab
      await createTestTabs(testUserId, [
        {
          url: "https://duplicate.com",
          title: "Duplicate Tab",
          windowId: 1,
          client_tab_id: 1002,
        },
      ]);

      const batchData = {
        tabs: [
          {
            url: "https://duplicate.com", // This is a duplicate
            title: "Duplicate Tab",
            windowId: 1,
            client_tab_id: 1002,
          },
          {
            url: "https://new-tab.com",
            title: "New Tab",
            windowId: 1,
          },
        ],
      };

      const response = await client.post("/api/v1/tabs/batch").send(batchData);

      expect(response.status).toBe(201);
      expect(response.body.stats).toHaveProperty("created", 1);
      expect(response.body.stats).toHaveProperty("skipped", 1);
    });
  });

  describe("GET /api/v1/tabs", () => {
    beforeAll(async () => {
      // Create some test tabs
      await createTestTabs(testUserId, [
        { url: "https://example.com/1", title: "Tab 1", windowId: 1 },
        { url: "https://example.com/2", title: "Tab 2", windowId: 1 },
        { url: "https://example.com/3", title: "Tab 3", windowId: 2 },
      ]);
    });

    it("should retrieve all tabs for the authenticated user", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const response = await client.get("/api/v1/tabs");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3);

      // Verify all tabs belong to the test user
      const allBelongToUser = response.body.every(
        (tab: { user_id: number }) => tab.user_id === testUserId,
      );
      expect(allBelongToUser).toBe(true);
    });

    it("should filter tabs by windowId", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const response = await client.get("/api/v1/tabs?windowId=2");

      expect(response.status).toBe(200);
      expect(Array.isArray(response.body)).toBe(true);

      // Should only have tabs from window 2
      const allFromWindow2 = response.body.every(
        (tab: { window_id: number }) => tab.window_id === 2,
      );
      expect(allFromWindow2).toBe(true);
    });
  });

  describe("DELETE /api/v1/tabs/:id", () => {
    let tabIdToDelete: number;

    beforeAll(async () => {
      // Create a tab to delete
      const [id] = await createTestTabs(testUserId, [
        {
          url: "https://to-delete.com",
          title: "Tab to delete",
          windowId: 1,
        },
      ]);
      tabIdToDelete = id;
    });

    it("should delete an existing tab", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const response = await client.delete(`/api/v1/tabs/${tabIdToDelete}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty("success", true);

      // Verify the tab was actually deleted
      const tab = await getAsync("SELECT * FROM tabs WHERE id = ?", [
        tabIdToDelete,
      ]);
      expect(tab).toBeUndefined();
    });

    it("should return 404 for non-existent tab", async () => {
      const client = createTestClient(testUserId, testUser.email);

      const response = await client.delete("/api/v1/tabs/999999");

      expect(response.status).toBe(404);
      expect(response.body).toHaveProperty("error");
    });

    it("should not allow deleting other users' tabs", async () => {
      // Create another user
      const otherUser = {
        email: "other@example.com",
        name: "Other User",
        token: "other-token",
      };
      const otherUserId = await createTestUser(otherUser);

      // Create a tab for the other user
      const [otherUserTabId] = await createTestTabs(otherUserId, [
        {
          url: "https://other-user-tab.com",
          title: "Other User Tab",
          windowId: 1,
        },
      ]);

      // Try to delete the other user's tab with the first user's credentials
      const client = createTestClient(testUserId, testUser.email);
      const response = await client.delete(`/api/v1/tabs/${otherUserTabId}`);

      expect(response.status).toBe(404); // Should return 404, not 403, to avoid leaking information
    });
  });
});
