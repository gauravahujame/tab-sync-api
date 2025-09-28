/**
 * Tab interface representing browser tab data
 */
export interface Tab {
  id?: number;
  client_tab_id: number;
  url: string;
  title?: string;
  window_id: number;
  opener_tab_id?: number;
  last_accessed?: number;
  incognito?: boolean;
  group_id?: number;
  browser_name?: string;
  user_id: number;
  created_at?: string;
}

/**
 * Database Tab Row interface
 */
export interface TabRow {
  id: number;
  client_tab_id: number;
  url: string;
  title?: string;
  window_id: number;
  opener_tab_id?: number;
  last_accessed?: number;
  incognito: boolean;
  group_id?: number;
  browser_name?: string;
  user_id: number;
  created_at: string;
}
