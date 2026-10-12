import { createContext, useContext } from "react";
import type { MessageCommands } from "./messageCommands";

export const MessageCommandsContext = createContext<MessageCommands | null>(null);

/** Message commands over the live socket; null outside the dashboard (no connection exists there). */
export const useMessageCommands = () => useContext(MessageCommandsContext);
