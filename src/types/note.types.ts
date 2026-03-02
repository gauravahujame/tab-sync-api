/**
 * Note types and validation schemas
 * Domain-scoped user notes for tab context
 */

import { z } from 'zod';

// ==================== Database Row Types ====================

export interface NoteRow {
  id: number;
  user_id: number;
  domain: string;
  url: string;
  title: string;
  content: string;
  created_at: Date;
  updated_at: Date;
}

// ==================== API Response Types ====================

export interface NoteResponse {
  id: number;
  domain: string;
  url: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
}

// ==================== Validation Schemas ====================

export const createNoteSchema = z.object({
  domain: z
    .string()
    .min(1, 'Domain is required')
    .max(255, 'Domain too long')
    .transform(val => val.toLowerCase().trim()),
  url: z
    .string()
    .max(2048, 'URL too long')
    .optional()
    .default(''),
  title: z
    .string()
    .max(500, 'Title too long')
    .optional()
    .default(''),
  content: z
    .string()
    .min(1, 'Note content cannot be empty')
    .max(10000, 'Note content too long (max 10,000 characters)'),
});

export const updateNoteSchema = z.object({
  content: z
    .string()
    .min(1, 'Note content cannot be empty')
    .max(10000, 'Note content too long (max 10,000 characters)')
    .optional(),
  title: z
    .string()
    .max(500, 'Title too long')
    .optional(),
});

export type CreateNoteInput = z.infer<typeof createNoteSchema>;
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>;

// ==================== Helpers ====================

/**
 * Convert a database row to an API response
 */
export function noteRowToResponse(row: NoteRow): NoteResponse {
  return {
    id: row.id,
    domain: row.domain,
    url: row.url,
    title: row.title,
    content: row.content,
    createdAt: new Date(row.created_at).toISOString(),
    updatedAt: new Date(row.updated_at).toISOString(),
  };
}
