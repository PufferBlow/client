import { useOutletContext } from "react-router";
import type { ServerInfo } from "../features/server/types";
import type { InstanceConfig } from "../services/types";

export interface AuthArtState {
  instance: InstanceConfig | null;
  info: ServerInfo | null;
}

/** What the sign-in pages hand up so the art beside them can show the instance being asked about. */
export interface AuthLayoutContext {
  setArt: (art: AuthArtState) => void;
}

/** For the pages inside the layout; outside it (a test, a page on its own) there is nothing to update. */
export function useAuthArt(): AuthLayoutContext["setArt"] {
  return useOutletContext<AuthLayoutContext | undefined>()?.setArt ?? (() => undefined);
}
