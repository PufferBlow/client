import { createContext, useContext } from "react";
import type { ConnectionStatus } from "./client";

export const ConnectionStatusContext = createContext<ConnectionStatus>("disconnected");

/** Live connection state, e.g. for a "reconnecting" indicator. */
export const useConnectionStatus = () => useContext(ConnectionStatusContext);
