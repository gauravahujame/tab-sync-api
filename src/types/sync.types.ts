/**
 * Type definitions for stateless marker-based sync
 */

export type EventType =
  | 'navigation'
  | 'tab-created'
  | 'tab-updated'
  | 'tab-removed'
  | 'window-created'
  | 'window-removed'
  | 'time-entry'
  | 'session-restored';

/**
 * Base event structure
 */
export interface BaseEvent {
  eventType: EventType;
  documentId?: string; // Unique ID for deduplication
  timestamp: number;
  instanceId: string;
}

/**
 * Navigation event (user navigates to a page)
 */
export interface NavigationEvent extends BaseEvent {
  eventType: 'navigation';
  tabId: number;
  windowId: number;
  url: string;
  title?: string;
  navigationType?: string;
  fromAddressBar?: boolean;
  tabCount?: number;
  windowCount?: number;
}

/**
 * Time entry event (time spent on a tab)
 */
export interface TimeEntryEvent extends BaseEvent {
  eventType: 'time-entry';
  tabId: number;
  windowId: number;
  url: string;
  title?: string;
  startTime: number;
  endTime: number;
  durationMs: number;
  wasActive: boolean;
  wasWindowFocused: boolean;
  userWasActive: boolean;
}

/**
 * Session restored event
 */
export interface SessionRestoredEvent extends BaseEvent {
  eventType: 'session-restored';
  originalSessionId: string;
  newWindowId?: number;
}

/**
 * Generic tab event
 */
export interface TabEvent extends BaseEvent {
  eventType: 'tab-created' | 'tab-updated' | 'tab-removed';
  tabId: number;
  windowId: number;
  url?: string;
  title?: string;
}

/**
 * Generic window event
 */
export interface WindowEvent extends BaseEvent {
  eventType: 'window-created' | 'window-removed';
  windowId: number;
}

/**
 * Union type for all events
 */
export type Event =
  | NavigationEvent
  | TimeEntryEvent
  | SessionRestoredEvent
  | TabEvent
  | WindowEvent;

/**
 * Sync marker (server tells extension where to resume sync)
 */
export interface SyncMarker {
  instanceId: string;
  lastEventTimestamp: number;
  lastSessionId?: string;
  firstSync: boolean;
  eventCountToSync?: number;
}

/**
 * Database row for sync marker
 */
export interface SyncMarkerRow {
  id: number;
  user_id: number;
  instance_id: string;
  last_event_timestamp: number;
  last_session_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Sync event payload from extension
 */
export interface SyncEventPayload {
  instanceId: string;
  fromTimestamp: number;
  events: Event[];
  restorationMetadata?: RestorationMetadata[];
}

/**
 * Session restoration metadata
 */
export interface RestorationMetadata {
  eventType: 'session-restored';
  originalSessionId: string;
  restoredAt: number;
  newWindowId?: number;
}

/**
 * Sync result returned to extension
 */
export interface SyncResult {
  instanceId: string;
  eventsReceived: number;
  eventsProcessed: number;
  duplicateCount: number;
  restorationMappings?: number;
  message: string;
}

/**
 * Database row for event
 */
export interface EventRow {
  id: number;
  user_id: number;
  instance_id: string;
  event_type: string;
  document_id: string | null;
  tab_id: number | null;
  window_id: number | null;
  url: string | null;
  title: string | null;
  navigation_type: string | null;
  from_address_bar: number;
  start_time: number | null;
  end_time: number | null;
  duration_ms: number | null;
  was_active: number | null;
  was_window_focused: number | null;
  user_was_active: number | null;
  tab_count: number | null;
  window_count: number | null;
  original_session_id: string | null;
  new_window_id: number | null;
  timestamp: number;
  synced_at: string;
  metadata: string | null;
}

/**
 * Event query filters
 */
export interface EventFilters {
  instanceId?: string;
  eventTypes?: EventType[];
  fromTimestamp?: number;
  toTimestamp?: number;
  limit?: number;
  offset?: number;
}

/**
 * Event statistics
 */
export interface EventStats {
  totalEvents: number;
  eventsByType: Record<string, number>;
  oldestEvent?: number;
  newestEvent?: number;
}
