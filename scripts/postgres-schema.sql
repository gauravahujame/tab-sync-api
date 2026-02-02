-- PostgreSQL Schema for Tab Sync API
-- Clean schema with snapshot-based sync (no obsolete tables)

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  name TEXT,
  token TEXT,
  browser_name TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Snapshots table (primary sync mechanism)
CREATE TABLE IF NOT EXISTS snapshots (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  version_number BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  snapshot_data JSONB NOT NULL,
  snapshot_hash VARCHAR(64) NOT NULL,
  size_bytes INTEGER,
  UNIQUE(user_id, instance_id, version_number),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance ON snapshots(user_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_snapshots_instance_version ON snapshots(instance_id, version_number DESC);
CREATE INDEX IF NOT EXISTS idx_snapshots_hash ON snapshots(instance_id, snapshot_hash);
CREATE INDEX IF NOT EXISTS idx_snapshots_created ON snapshots(created_at);
CREATE INDEX IF NOT EXISTS idx_snapshots_user_instance_version ON snapshots(user_id, instance_id, version_number DESC);

-- Sessions table (user-saved sessions)
CREATE TABLE IF NOT EXISTS sessions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  session_id TEXT NOT NULL,
  instance_id TEXT NOT NULL,
  name TEXT,
  description TEXT,
  tags TEXT,
  captured_at BIGINT NOT NULL,
  tab_count INTEGER NOT NULL DEFAULT 0,
  window_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, session_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_instance ON sessions(instance_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_instance ON sessions(user_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_sessions_captured_at ON sessions(captured_at);
CREATE INDEX IF NOT EXISTS idx_sessions_session_id ON sessions(session_id);

-- Session windows table
CREATE TABLE IF NOT EXISTS session_windows (
  id SERIAL PRIMARY KEY,
  session_id INTEGER NOT NULL,
  window_id INTEGER NOT NULL,
  focused BOOLEAN DEFAULT FALSE,
  incognito BOOLEAN DEFAULT FALSE,
  type TEXT,
  window_order INTEGER NOT NULL,
  FOREIGN KEY(session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_windows_session_id ON session_windows(session_id);

-- Session tabs table
CREATE TABLE IF NOT EXISTS session_tabs (
  id SERIAL PRIMARY KEY,
  session_window_id INTEGER NOT NULL,
  tab_id INTEGER NOT NULL,
  url TEXT NOT NULL,
  title TEXT,
  tab_index INTEGER NOT NULL,
  active BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  group_id INTEGER,
  fav_icon_url TEXT,
  FOREIGN KEY(session_window_id) REFERENCES session_windows(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_tabs_window_id ON session_tabs(session_window_id);

-- Session restorations table
CREATE TABLE IF NOT EXISTS session_restorations (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  original_session_id TEXT NOT NULL,
  new_window_id INTEGER,
  restored_at TIMESTAMPTZ DEFAULT NOW(),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_restorations_user_instance ON session_restorations(user_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_session_restorations_session_id ON session_restorations(original_session_id);
