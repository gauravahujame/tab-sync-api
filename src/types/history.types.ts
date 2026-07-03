/**
 * Browsing history types and validation schemas
 * Domain and tag-scoped page visit history for browser extensions
 */

import { z } from 'zod';

// ==================== Database Row Types ====================

export interface HistoryRow {
  id: number;
  user_id: number;
  url: string;
  title: string;
  domain: string;
  tags: string | null;
  visit_count: number;
  last_visited_at: number;
  first_visited_at: number;
  created_at: string;
  updated_at: string;
}

// ==================== API Response Types ====================

export interface HistoryEntry {
  id: number;
  url: string;
  title: string;
  domain: string;
  tags: string[];
  visitCount: number;
  lastVisitedAt: number;
  firstVisitedAt: number;
  createdAt: string;
  updatedAt: string;
}

// ==================== Validation Schemas ====================

export const createHistoryEntrySchema = z.object({
  url: z.string().url('Invalid URL').max(2048, 'URL too long'),
  title: z.string().max(500, 'Title too long').optional().default(''),
  domain: z
    .string()
    .min(1, 'Domain is required')
    .max(255, 'Domain too long')
    .transform(val => val.toLowerCase().trim()),
  tags: z.array(z.string().min(1).max(50)).max(20).optional().default([]),
  visitedAt: z.number().int().positive().optional(),
});

export const updateHistoryEntrySchema = z.object({
  title: z.string().max(500, 'Title too long').optional(),
  tags: z.array(z.string().min(1).max(50)).max(20).optional(),
});

export const historyListFiltersSchema = z.object({
  tags: z.string().optional(),
  domain: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  search: z.string().optional(),
  limit: z.string().optional(),
  offset: z.string().optional(),
});

export type CreateHistoryEntryInput = z.infer<typeof createHistoryEntrySchema>;
export type UpdateHistoryEntryInput = z.infer<typeof updateHistoryEntrySchema>;
export type HistoryListFilters = z.infer<typeof historyListFiltersSchema>;

// ==================== Helpers ====================

/**
 * Convert a database row to an API response
 */
export function historyRowToResponse(row: HistoryRow): HistoryEntry {
  return {
    id: row.id,
    url: row.url,
    title: row.title,
    domain: row.domain,
    tags: row.tags ? JSON.parse(row.tags) : [],
    visitCount: row.visit_count,
    lastVisitedAt: row.last_visited_at,
    firstVisitedAt: row.first_visited_at,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}

/**
 * Parse tags from a comma-separated query string
 */
export function parseTagsQuery(tags: string | undefined): string[] | undefined {
  if (!tags) return undefined;
  const parsed = tags
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(tag => tag.length > 0);
  return parsed.length > 0 ? parsed : undefined;
}
