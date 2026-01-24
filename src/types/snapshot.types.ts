/**
 * Snapshot Types - Server-side type definitions for snapshot-based sync
 *
 * These types mirror the client-side definitions and add server-specific
 * fields for storage and processing.
 */

import { z } from 'zod';

// ==================== CORE SNAPSHOT TYPES ====================

/**
 * Complete browser state snapshot
 */
export interface TabiumSnapshot {
  version: '1.0.0';
  instanceId: string;
  capturedAt: number;
  windows: WindowSnapshot[];
  groups: GroupSnapshot[];
  metadata: SnapshotMetadata;
}

/**
 * Window state within a snapshot
 */
export interface WindowSnapshot {
  windowId: string;
  customName?: string;
  state: 'normal' | 'minimized' | 'maximized' | 'fullscreen';
  focused: boolean;
  tabs: TabSnapshot[];
  bounds?: WindowBounds;
}

/**
 * Window position and dimensions
 */
export interface WindowBounds {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Tab state within a snapshot
 */
export interface TabSnapshot {
  tabId: string;
  url: string;
  title: string;
  favIconUrl?: string;
  pinned: boolean;
  groupId?: string;
  index: number;
  suspended: boolean;
  lastAccessed?: number;
}

/**
 * Tab group state within a snapshot
 */
export interface GroupSnapshot {
  groupId: string;
  title: string;
  color: TabGroupColor;
  collapsed: boolean;
}

/**
 * Valid Chrome tab group colors
 */
export type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  totalTabs: number;
  totalWindows: number;
  totalGroups: number;
  deviceInfo: DeviceInfo;
}

/**
 * Device information
 */
export interface DeviceInfo {
  platform: string;
  chromeVersion: string;
}

// ==================== DATABASE TYPES ====================

/**
 * Snapshot row as stored in database
 */
export interface SnapshotRow {
  id: number;
  user_id: number;
  instance_id: string;
  version_number: number;
  created_at: Date;
  snapshot_data: TabiumSnapshot;
  snapshot_hash: string;
  size_bytes: number;
}

/**
 * Migration checkpoint row
 */
export interface MigrationCheckpointRow {
  instance_id: string;
  events_processed: number;
  intermediate_state: Record<string, unknown>;
  created_at: Date;
}

// ==================== API REQUEST/RESPONSE TYPES ====================

/**
 * Request payload for snapshot upload
 */
export interface SnapshotUploadRequest {
  instanceId: string;
  snapshotData: TabiumSnapshot;
  snapshotHash: string;
}

/**
 * Response from snapshot upload
 */
export interface SnapshotUploadResponse {
  success: boolean;
  versionNumber: number;
  isDuplicate: boolean;
  timestamp: number;
}

/**
 * Response for latest snapshot request
 */
export interface LatestSnapshotResponse {
  versionNumber: number;
  snapshotData: TabiumSnapshot;
  createdAt: string;
}

/**
 * Timeline item for snapshot list
 */
export interface SnapshotTimelineItem {
  versionNumber: number;
  createdAt: string;
  metadata: {
    totalTabs: number;
    totalWindows: number;
    totalGroups: number;
  };
}

/**
 * Timeline response
 */
export interface SnapshotTimelineResponse {
  snapshots: SnapshotTimelineItem[];
  total: number;
}

// ==================== INGESTION RESULT ====================

/**
 * Result from ingesting a snapshot
 */
export interface SnapshotIngestResult {
  versionNumber: number;
  isDuplicate: boolean;
  sizeBytes: number;
}

// ==================== RETENTION POLICY ====================

/**
 * Retention policy constants
 */
export const RETENTION_POLICY = {
  HOURS_48: 48 * 60 * 60 * 1000,
  DAYS_7: 7 * 24 * 60 * 60 * 1000,
  DAYS_30: 30 * 24 * 60 * 60 * 1000,
  DAYS_90: 90 * 24 * 60 * 60 * 1000,
  MONTHS_12: 365 * 24 * 60 * 60 * 1000,
} as const;

// ==================== ZOD VALIDATION SCHEMAS ====================

/**
 * Tab group color schema
 */
const tabGroupColorSchema = z.enum([
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
]);

/**
 * Window bounds schema
 */
const windowBoundsSchema = z.object({
  left: z.number(),
  top: z.number(),
  width: z.number(),
  height: z.number(),
});

/**
 * Tab snapshot schema
 */
const tabSnapshotSchema = z.object({
  tabId: z.string().uuid(),
  url: z.string(),
  title: z.string(),
  favIconUrl: z.string().optional(),
  pinned: z.boolean(),
  groupId: z.string().uuid().optional(),
  index: z.number().int().min(0),
  suspended: z.boolean(),
  lastAccessed: z.number().optional(),
});

/**
 * Window snapshot schema
 */
const windowSnapshotSchema = z.object({
  windowId: z.string().uuid(),
  customName: z.string().optional(),
  state: z.enum(['normal', 'minimized', 'maximized', 'fullscreen']),
  focused: z.boolean(),
  tabs: z.array(tabSnapshotSchema),
  bounds: windowBoundsSchema.optional(),
});

/**
 * Group snapshot schema
 */
const groupSnapshotSchema = z.object({
  groupId: z.string().uuid(),
  title: z.string(),
  color: tabGroupColorSchema,
  collapsed: z.boolean(),
});

/**
 * Device info schema
 */
const deviceInfoSchema = z.object({
  platform: z.string(),
  chromeVersion: z.string(),
});

/**
 * Snapshot metadata schema
 */
const snapshotMetadataSchema = z.object({
  totalTabs: z.number().int().min(0),
  totalWindows: z.number().int().min(0),
  totalGroups: z.number().int().min(0),
  deviceInfo: deviceInfoSchema,
});

/**
 * Complete snapshot schema for validation
 */
export const tabiumSnapshotSchema = z.object({
  version: z.literal('1.0.0'),
  instanceId: z.string().uuid(),
  capturedAt: z.number(),
  windows: z.array(windowSnapshotSchema),
  groups: z.array(groupSnapshotSchema),
  metadata: snapshotMetadataSchema,
});

/**
 * Snapshot upload request schema
 */
export const snapshotUploadRequestSchema = z.object({
  instanceId: z.string().uuid(),
  snapshotData: tabiumSnapshotSchema,
  snapshotHash: z.string().length(64), // SHA-256 hex string
});

/**
 * Validate snapshot data
 */
export function validateSnapshot(data: unknown): {
  success: boolean;
  data?: TabiumSnapshot;
  error?: z.ZodError;
} {
  const result = tabiumSnapshotSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as TabiumSnapshot };
  }
  return { success: false, error: result.error };
}

/**
 * Validate upload request
 */
export function validateUploadRequest(data: unknown): {
  success: boolean;
  data?: SnapshotUploadRequest;
  error?: z.ZodError;
} {
  const result = snapshotUploadRequestSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data as SnapshotUploadRequest };
  }
  return { success: false, error: result.error };
}
