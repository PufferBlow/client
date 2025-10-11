import { useState, useEffect, useCallback } from 'react';
import type { Channel } from '../models';

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
    setSelectedServer,
    setSelectedChannel,
    setMessageDraft,
    getMessageDraft,
    clearMessageDraft,
    clearAllState,
  };
}
