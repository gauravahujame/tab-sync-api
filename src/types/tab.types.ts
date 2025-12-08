/**
 * Muted info for tab audio state
 */
export interface MutedInfo {
  muted: boolean;
  reason?: 'user' | 'capture' | 'extension';
  extensionId?: string;
}

/**
 * Tab interface representing browser tab data with all Chrome Tab API fields
 */
export interface Tab {
  id?: number;
  client_tab_id?: number;
  window_id: number;
  index?: number;
  active?: boolean;
  highlighted?: boolean;
  pinned?: boolean;
  audible?: boolean;
  muted_info?: string; // JSON string of MutedInfo
  discarded?: boolean;
  auto_discardable?: boolean;
  frozen?: boolean;
  group_id?: number;
  incognito: boolean;
  url: string;
  title?: string;
  fav_icon_url?: string;
  pending_url?: string;
  opener_tab_id?: number;
  session_id?: string;
  last_accessed?: number;
  status?: 'unloaded' | 'loading' | 'complete';
  width?: number;
  height?: number;
  browser_name?: string;
  user_id: number;
  created_at?: string;
}

/**
 * Database Tab Row interface
 */
export interface TabRow {
  id: number;
  client_tab_id?: number;
  window_id: number;
  index?: number;
  active?: boolean;
  highlighted?: boolean;
  pinned?: boolean;
  audible?: boolean;
  muted_info?: string; // JSON string
  discarded?: boolean;
  auto_discardable?: boolean;
  frozen?: boolean;
  group_id?: number;
  incognito: boolean;
  url: string;
  title?: string;
  fav_icon_url?: string;
  pending_url?: string;
  opener_tab_id?: number;
  session_id?: string;
  last_accessed?: number;
  status?: string;
  width?: number;
  height?: number;
  browser_name?: string;
  user_id: number;
  created_at: string;
}
