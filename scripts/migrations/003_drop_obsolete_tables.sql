-- Migration: Drop obsolete tables from marker-based sync
-- Version: 003
-- Date: 2026-02-02
-- Description: Removes tabs, events, and sync_markers tables that were replaced by snapshot-based sync

-- Drop obsolete tables (order matters due to foreign key references)
DROP TABLE IF EXISTS sync_markers CASCADE;
DROP TABLE IF EXISTS events CASCADE;
DROP TABLE IF EXISTS tabs CASCADE;

-- Drop migration checkpoints table (was used for event-to-snapshot migration)
DROP TABLE IF EXISTS migration_checkpoints CASCADE;

-- Verify cleanup
DO $$
BEGIN
  RAISE NOTICE 'Obsolete tables dropped successfully:';
  RAISE NOTICE '  - sync_markers (replaced by snapshot versioning)';
  RAISE NOTICE '  - events (replaced by snapshot sync)';
  RAISE NOTICE '  - tabs (replaced by snapshot sync)';
  RAISE NOTICE '  - migration_checkpoints (migration complete)';
END $$;
