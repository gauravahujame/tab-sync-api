import { describe, it, expect } from "@jest/globals";
import {
  tabSchema,
  batchTabsSchema,
} from "../../../src/validators/tabs.validator.js";

describe("Tab Validation", () => {
  describe("Single Tab Validation", () => {
    it("should validate a valid tab object", () => {
      const validTab = {
        url: "https://example.com",
        title: "Example Domain",
        windowId: 1,
        client_tab_id: 1001,
        last_accessed: Date.now(),
        incognito: false,
        group_id: -1,
        browser_name: "test-browser",
      };

      const result = tabSchema.safeParse(validTab);
      expect(result.success).toBe(true);
    });

    it("should require url field", () => {
      const invalidTab = {
        title: "Missing URL",
        windowId: 1,
      };

      const result = tabSchema.safeParse(invalidTab);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("url") && issue.code === "invalid_type",
          ),
        ).toBe(true);
      }
    });

    it("should validate URL format", () => {
      const invalidTab = {
        url: "not-a-url",
        windowId: 1,
      };

      const result = tabSchema.safeParse(invalidTab);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("url") && issue.code === "invalid_string",
          ),
        ).toBe(true);
      }
    });

    it("should set default values for optional fields", () => {
      const minimalTab = {
        url: "https://example.com",
        windowId: 1,
      };

      const result = tabSchema.safeParse(minimalTab);
      expect(result.success).toBe(true);
      if (result.success) {
        const { data } = result;
        expect(data.title).toBeUndefined();
        expect(data.client_tab_id).toBeUndefined();
        expect(data.last_accessed).toBeUndefined();
        expect(data.incognito).toBe(false);
        expect(data.group_id).toBe(-1);
        expect(data.browser_name).toBeUndefined();
      }
    });
  });

  describe("Batch Tabs Validation", () => {
    it("should validate a valid batch of tabs", () => {
      const validBatch = {
        tabs: [
          { url: "https://example.com/1", windowId: 1 },
          { url: "https://example.com/2", windowId: 1, title: "Second Tab" },
          { url: "https://example.com/3", windowId: 2, incognito: true },
        ],
      };

      const result = batchTabsSchema.safeParse(validBatch);
      expect(result.success).toBe(true);
    });

    it("should reject an empty tabs array", () => {
      const invalidBatch = {
        tabs: [],
      };

      const result = batchTabsSchema.safeParse(invalidBatch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("tabs") && issue.code === "too_small",
          ),
        ).toBe(true);
      }
    });

    it("should enforce maximum batch size", () => {
      // Create a batch with 5001 tabs (1 over the limit)
      const largeBatch = {
        tabs: Array(5001)
          .fill(0)
          .map((_, i) => ({
            url: `https://example.com/${i}`,
            windowId: 1,
          })),
      };

      const result = batchTabsSchema.safeParse(largeBatch);
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (issue) => issue.path.includes("tabs") && issue.code === "too_big",
          ),
        ).toBe(true);
      }
    });

    it("should validate each tab in the batch", () => {
      const invalidBatch = {
        tabs: [
          { url: "https://example.com/1", windowId: 1 },
          { title: "Missing URL" }, // Invalid tab
          { url: "https://example.com/3", windowId: 2 },
        ],
      };

      const result = batchTabsSchema.safeParse(invalidBatch);
      expect(result.success).toBe(false);
      if (!result.success) {
        // Should have an error for the second tab
        expect(
          result.error.issues.some(
            (issue) =>
              issue.path.includes("tabs") &&
              issue.path.includes(1) &&
              issue.path.includes("url"),
          ),
        ).toBe(true);
      }
    });
  });

  describe("Edge Cases", () => {
    it("should handle very long URLs", () => {
      const longUrl = "https://example.com/" + "a".repeat(2000);
      const tab = {
        url: longUrl,
        windowId: 1,
      };

      const result = tabSchema.safeParse(tab);
      expect(result.success).toBe(true);
    });

    it("should handle special characters in URLs", () => {
      const specialUrl =
        "https://example.com/path/with/special?chars=!@#$%^&*()_+{}[]|\\:;'\"<>,.?/~`";
      const tab = {
        url: specialUrl,
        windowId: 1,
      };

      const result = tabSchema.safeParse(tab);
      expect(result.success).toBe(true);
    });

    it("should handle very large windowId values", () => {
      const tab = {
        url: "https://example.com",
        windowId: Number.MAX_SAFE_INTEGER,
      };

      const result = tabSchema.safeParse(tab);
      expect(result.success).toBe(true);
    });
  });
});
