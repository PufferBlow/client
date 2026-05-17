import { useState, useEffect, useCallback } from 'react';
import type { Channel } from '../models';

// Storage key for the "where was the user last" pointer. Kept under a
// fixed key (not per-user) because the index route consults this
// before the current user is known — the destination is just a path,
// so it's safe to share across accounts on the same device.
const LAST_ROUTE_STORAGE_KEY = 'pufferblow-last-visited-route';

/**
 * Interface for persisted UI state
 */
export interface PersistedUIState {
  /** Currently selected server ID */
  selectedServerId?: string;
  /** Currently selected channel ID */
  selectedChannelId?: string;
  /** Draft messages keyed by channel ID */
  messageDrafts: Record<string, string>;
  /**
   * Last tab the user had open in the control panel (e.g. "overview",
   * "members", "logs"). Persisted so reopening the control panel after
   * a refresh / desktop restart lands the user back where they were
   * instead of jumping to the default tab.
   */
  controlPanelTabId?: string;
  /**
   * Last route the app was on (e.g. "/dashboard", "/control-panel").
   * Used by the entry route to redirect an authenticated user back to
   * where they were instead of dropping them on the marketing home.
   */
  lastVisitedRoute?: string;
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Hook for managing persisted UI state using localStorage
 */
export function usePersistedUIState(userId?: string) {
  // Create storage key based on user ID to keep state per-user
  const storageKey = `pufferblow-ui-state-${userId || 'anonymous'}`;

  // Initial state
  const [state, setState] = useState<PersistedUIState>({
    messageDrafts: {},
  });

  // Load persisted state on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved) as PersistedUIState;

        // Validate the structure (basic validation)
        if (parsed && typeof parsed === 'object' && parsed.messageDrafts && typeof parsed.messageDrafts === 'object') {
          setState(parsed);
        } else {
          // Reset if corrupted
          console.warn('Persisted UI state corrupted, resetting to default');
          setState({ messageDrafts: {} });
        }
      }
    } catch (error) {
      console.error('Failed to load persisted UI state:', error);
      setState({ messageDrafts: {} });
    }
  }, [storageKey]);

  // Save state to localStorage whenever it changes
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stateToSave = {
        ...state,
        lastUpdated: new Date().toISOString(),
      };
      localStorage.setItem(storageKey, JSON.stringify(stateToSave));
    } catch (error) {
      console.error('Failed to save UI state to localStorage:', error);
    }
  }, [state, storageKey]);

  // Helper functions to update specific parts of the state
  const setSelectedServer = useCallback((serverId: string | undefined) => {
    setState(prev => ({
      ...prev,
      selectedServerId: serverId,
    }));
  }, []);

  const setSelectedChannel = useCallback((channelId: string | undefined) => {
    setState(prev => ({
      ...prev,
      selectedChannelId: channelId,
    }));
  }, []);

  const setControlPanelTabId = useCallback((tabId: string | undefined) => {
    setState(prev => ({
      ...prev,
      controlPanelTabId: tabId,
    }));
  }, []);

  const setLastVisitedRoute = useCallback((route: string | undefined) => {
    setState(prev => ({
      ...prev,
      lastVisitedRoute: route,
    }));
  }, []);

  const setMessageDraft = useCallback((channelId: string, message: string) => {
    setState(prev => ({
      ...prev,
      messageDrafts: {
        ...prev.messageDrafts,
        [channelId]: message,
      },
    }));
  }, []);

  const getMessageDraft = useCallback((channelId: string): string => {
    return state.messageDrafts[channelId] || '';
  }, [state.messageDrafts]);

  const clearMessageDraft = useCallback((channelId: string) => {
    setState(prev => {
      const newDrafts = { ...prev.messageDrafts };
      delete newDrafts[channelId];
      return {
        ...prev,
        messageDrafts: newDrafts,
      };
    });
  }, []);

  // Clear all persisted state (useful on logout)
  const clearAllState = useCallback(() => {
    setState({ messageDrafts: {} });
    if (typeof window !== 'undefined') {
      localStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  return {
    selectedServerId: state.selectedServerId,
    selectedChannelId: state.selectedChannelId,
    messageDrafts: state.messageDrafts,
    controlPanelTabId: state.controlPanelTabId,
    lastVisitedRoute: state.lastVisitedRoute,
    setSelectedServer,
    setSelectedChannel,
    setControlPanelTabId,
    setLastVisitedRoute,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
    clearAllState,
  };
}

/**
 * Side-channel reader for the persisted UI state. Used outside of
 * React (e.g. on the marketing landing page) to peek at the last
 * route an authenticated user was on without spinning up the hook.
 *
 * Returns `undefined` on the server (no localStorage) and on a parse
 * failure — callers should fall back to their default destination.
 */
export function readPersistedUIState(userId?: string): PersistedUIState | undefined {
  if (typeof window === 'undefined') return undefined;
  const storageKey = `pufferblow-ui-state-${userId || 'anonymous'}`;
  try {
    const saved = localStorage.getItem(storageKey);
    if (!saved) return undefined;
    const parsed = JSON.parse(saved) as PersistedUIState;
    if (!parsed || typeof parsed !== 'object') return undefined;
    return parsed;
  } catch {
    return undefined;
  }
}

/**
 * Read the last-visited app route, regardless of which user was
 * signed in at the time. Used by the landing page to redirect an
 * already-authenticated user back to where they were instead of
 * dropping them on the marketing copy.
 */
export function getLastVisitedRoute(): string | undefined {
  if (typeof window === 'undefined') return undefined;
  try {
    const value = localStorage.getItem(LAST_ROUTE_STORAGE_KEY);
    return value && value.startsWith('/') ? value : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Persist a route as the user's last-visited destination. Call this
 * from authed pages (dashboard, control panel, settings) on mount so
 * the index route can rehydrate the right destination next time.
 *
 * We write to localStorage directly (not through usePersistedUIState)
 * because the consumer is anonymous-by-design: the route pointer is
 * the FIRST thing we need before we know which user to load.
 */
export function useTrackLastRoute(route: string): void {
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!route || !route.startsWith('/')) return;
    try {
      localStorage.setItem(LAST_ROUTE_STORAGE_KEY, route);
    } catch {
      // Best-effort; ignore quota / privacy-mode failures.
    }
  }, [route]);
}
