-- PostgreSQL Schema for Tab Sync API
-- This script creates all tables required for the Tab Sync API

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

-- Tabs table
CREATE TABLE IF NOT EXISTS tabs (
  id SERIAL PRIMARY KEY,
  client_tab_id INTEGER,
  url TEXT NOT NULL,
  title TEXT,
  window_id INTEGER NOT NULL,
  tab_index INTEGER,
  active BOOLEAN DEFAULT FALSE,
  highlighted BOOLEAN DEFAULT FALSE,
  pinned BOOLEAN DEFAULT FALSE,
  audible BOOLEAN DEFAULT FALSE,
  muted_info TEXT,
  discarded BOOLEAN DEFAULT FALSE,
  auto_discardable BOOLEAN DEFAULT TRUE,
  frozen BOOLEAN DEFAULT FALSE,
  group_id INTEGER DEFAULT -1,
  incognito BOOLEAN DEFAULT FALSE,
  fav_icon_url TEXT,
  pending_url TEXT,
  opener_tab_id INTEGER,
  session_id TEXT,
  last_accessed DOUBLE PRECISION,
  status TEXT,
  width INTEGER,
  height INTEGER,
  browser_name TEXT,
  user_id INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(url, window_id, client_tab_id, user_id, browser_name),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_tabs_user_id ON tabs(user_id);

-- Sync markers table
CREATE TABLE IF NOT EXISTS sync_markers (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  last_event_timestamp BIGINT NOT NULL DEFAULT 0,
  last_session_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, instance_id),
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_sync_markers_user_instance ON sync_markers(user_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_sync_markers_instance ON sync_markers(instance_id);

-- Events table
CREATE TABLE IF NOT EXISTS events (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  instance_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  document_id TEXT,
  tab_id INTEGER,
  window_id INTEGER,
  url TEXT,
  title TEXT,
  navigation_type TEXT,
  from_address_bar BOOLEAN DEFAULT FALSE,
  transition_type TEXT,
  transition_qualifiers TEXT,
  start_time BIGINT,
  end_time BIGINT,
  duration_ms INTEGER,
  was_active BOOLEAN,
  was_window_focused BOOLEAN,
  user_was_active BOOLEAN,
  tab_count INTEGER,
  window_count INTEGER,
  group_id INTEGER,
  group_name TEXT,
  group_color TEXT,
  original_session_id TEXT,
  new_window_id INTEGER,
  timestamp BIGINT NOT NULL,
  synced_at TIMESTAMPTZ DEFAULT NOW(),
  metadata TEXT,
  FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_instance ON events(instance_id);
CREATE INDEX IF NOT EXISTS idx_events_user_instance ON events(user_id, instance_id);
CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
CREATE INDEX IF NOT EXISTS idx_events_document_id ON events(document_id);
CREATE INDEX IF NOT EXISTS idx_events_instance_document ON events(instance_id, document_id);
CREATE INDEX IF NOT EXISTS idx_events_type ON events(event_type);
CREATE INDEX IF NOT EXISTS idx_events_user_type ON events(user_id, event_type);

-- Sessions table
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
