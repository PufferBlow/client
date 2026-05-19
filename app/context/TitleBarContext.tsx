import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';

/**
 * The title bar's center slot mirrors "where am I right now?" — same
 * information the user can read from the sidebar, but pulled up into
 * the chrome so it's visible while their attention is on the
 * message pane. The dashboard pushes its current state into this
 * context; the title bar reads it back out.
 *
 * Three signals make up the breadcrumb:
 *   - `serverAvatarUrl` — small square mark matching the rail's
 *     rectangular `rounded-lg` style, OR null to fall back to a
 *     letter chip.
 *   - `serverName`      — instance name displayed next to the mark.
 *   - `channelName`     — selected channel within that instance.
 *                         Hidden when DMs are open (channel concept
 *                         doesn't apply) or when nothing is selected.
 *
 * All fields are nullable so non-dashboard pages (settings, control
 * panel, auth) can leave the title bar empty by simply not
 * registering anything.
 */
interface TitleBarContextValue {
  serverName: string | null;
  serverAvatarUrl: string | null;
  channelName: string | null;
  setServerName: (name: string | null) => void;
  setServerAvatarUrl: (url: string | null) => void;
  setChannelName: (name: string | null) => void;
}

const TitleBarContext = createContext<TitleBarContextValue>({
  serverName: null,
  serverAvatarUrl: null,
  channelName: null,
  setServerName: () => {},
  setServerAvatarUrl: () => {},
  setChannelName: () => {},
});

export function TitleBarProvider({ children }: { children: ReactNode }) {
  const [serverName, setServerNameState] = useState<string | null>(null);
  const [serverAvatarUrl, setServerAvatarUrlState] = useState<string | null>(null);
  const [channelName, setChannelNameState] = useState<string | null>(null);

  // Stable setter identities so consumers can put these in effect
  // dep arrays without retriggering on every provider render.
  const setServerName = useCallback((name: string | null) => {
    setServerNameState(name);
  }, []);
  const setServerAvatarUrl = useCallback((url: string | null) => {
    setServerAvatarUrlState(url);
  }, []);
  const setChannelName = useCallback((name: string | null) => {
    setChannelNameState(name);
  }, []);

  const value = useMemo(
    () => ({
      serverName,
      serverAvatarUrl,
      channelName,
      setServerName,
      setServerAvatarUrl,
      setChannelName,
    }),
    [serverName, serverAvatarUrl, channelName, setServerName, setServerAvatarUrl, setChannelName],
  );

  return <TitleBarContext.Provider value={value}>{children}</TitleBarContext.Provider>;
}

export const useTitleBar = () => useContext(TitleBarContext);
