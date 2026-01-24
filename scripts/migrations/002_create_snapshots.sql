-- Migration: Create snapshots table for snapshot-based sync
-- Version: 002
-- Date: 2026-01-13

-- Create snapshots table
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  version_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot_data JSONB NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  size_bytes INTEGER,
  UNIQUE(user_id, instance_id, version_number)
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance
  ON snapshots(user_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_snapshots_instance_version
  ON snapshots(instance_id, version_number DESC);

CREATE INDEX IF NOT EXISTS idx_snapshots_hash
  ON snapshots(instance_id, snapshot_hash);

CREATE INDEX IF NOT EXISTS idx_snapshots_created
  ON snapshots(created_at);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance_version
  ON snapshots(user_id, instance_id, version_number DESC);

-- Migration checkpoints table for resumable event-to-snapshot migration
CREATE TABLE IF NOT EXISTS migration_checkpoints (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  instance_id TEXT NOT NULL,
  events_processed INTEGER NOT NULL DEFAULT 0,
  intermediate_state JSONB,
  status TEXT NOT NULL DEFAULT 'in_progress',
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  error_message TEXT,
  UNIQUE(user_id, instance_id)
);

CREATE INDEX IF NOT EXISTS idx_migration_checkpoints_user_instance
  ON migration_checkpoints(user_id, instance_id);

CREATE INDEX IF NOT EXISTS idx_migration_checkpoints_status
  ON migration_checkpoints(status);

-- Add comment for documentation
COMMENT ON TABLE snapshots IS 'Stores browser state snapshots for snapshot-based sync';
COMMENT ON COLUMN snapshots.version_number IS 'Server-assigned monotonically increasing version per user/instance';
COMMENT ON COLUMN snapshots.snapshot_hash IS 'SHA-256 hash for deduplication';
COMMENT ON COLUMN snapshots.size_bytes IS 'Size of snapshot_data in bytes';

COMMENT ON TABLE migration_checkpoints IS 'Tracks progress of event-to-snapshot migration for resumability';
