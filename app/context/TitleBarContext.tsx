import { createContext, useContext, useState } from 'react';
import type { ReactNode } from 'react';

interface TitleBarContextValue {
  serverName: string | null;
  setServerName: (name: string | null) => void;
}

const TitleBarContext = createContext<TitleBarContextValue>({
  serverName: null,
  setServerName: () => {},
});

export function TitleBarProvider({ children }: { children: ReactNode }) {
  const [serverName, setServerName] = useState<string | null>(null);
  return (
    <TitleBarContext.Provider value={{ serverName, setServerName }}>
      {children}
    </TitleBarContext.Provider>
  );
}

export const useTitleBar = () => useContext(TitleBarContext);
