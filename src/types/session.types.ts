/**
 * Type definitions for session management
 */

/**
 * Session capture (snapshot of browser state)
 */
export interface Session {
  id?: number;
  sessionId: string;
  userId: number;
  instanceId: string;
  name?: string;
  description?: string;
  tags?: string[];
  windows: SessionWindow[];
  capturedAt: number;
  tabCount: number;
  windowCount: number;
}

/**
 * Window within a session
 */
export interface SessionWindow {
  windowId: number;
  focused: boolean;
  incognito: boolean;
  type?: string;
  tabs: SessionTab[];
}

/**
 * Tab within a session window
 */
export interface SessionTab {
  tabId: number;
  url: string;
  title?: string;
  index: number;
  active: boolean;
  pinned: boolean;
  groupId?: number;
  favIconUrl?: string;
}

/**
 * Session creation DTO
 */
export interface CreateSessionDTO {
  sessionId: string;
  instanceId: string;
  name?: string;
  description?: string;
  tags?: string[];
  windows: SessionWindow[];
}

/**
 * Session update DTO
 */
export interface UpdateSessionDTO {
  name?: string;
  description?: string;
  tags?: string[];
}

/**
 * Database row for session
 */
export interface SessionRow {
  id: number;
  user_id: number;
  session_id: string;
  instance_id: string;
  name: string | null;
  description: string | null;
  tags: string | null;
  captured_at: number;
  tab_count: number;
  window_count: number;
  created_at: string;
}

/**
 * Database row for session window
 */
export interface SessionWindowRow {
  id: number;
  session_id: number;
  window_id: number;
  focused: number;
  incognito: number;
  type: string | null;
  window_order: number;
}

/**
 * Database row for session tab
 */
export interface SessionTabRow {
  id: number;
  session_window_id: number;
  tab_id: number;
  url: string;
  title: string | null;
  tab_index: number;
  active: number;
  pinned: number;
  group_id: number | null;
  fav_icon_url: string | null;
}

/**
 * Session restoration tracking
 */
export interface SessionRestoration {
  id?: number;
  userId: number;
  instanceId: string;
  originalSessionId: string;
  newWindowId?: number;
  restoredAt: number;
}

/**
 * Database row for session restoration
 */
export interface SessionRestorationRow {
  id: number;
  user_id: number;
  instance_id: string;
  original_session_id: string;
  new_window_id: number | null;
  restored_at: string;
}

/**
 * Session list filters
 */
export interface SessionListFilters {
  instanceId?: string;
  tags?: string[];
  fromDate?: number;
  toDate?: number;
  limit?: number;
  offset?: number;
}

/**
 * Session with windows and tabs (joined)
 */
export interface SessionWithDetails extends Session {
  windows: Array<
    SessionWindow & {
      tabs: SessionTab[];
    }
  >;
}
