import { serverLookOf, type ServerLook, type ServerLookChoice } from "../../lib/serverLook";
import { resolveAssetUrl } from "../../services/authed";
import { getStoredInstance } from "../../services/instance";
import type { ServerInfo } from "./types";
import { useServerInfo } from "./hooks";

type PictureFields = Pick<ServerInfo, "avatar_url" | "banner_url"> & { avatar_kind?: string | null; banner_kind?: string | null };

/**
 * The pictures the owner uploaded. The server hosts its default art at a URL too, but that is not a
 * choice: it is what the look below replaces, so only an upload counts as a picture. An instance that
 * does not say which it is (an older one) is taken at its word.
 */
export function serverPictures(server: PictureFields | undefined): { avatar: string | null; banner: string | null } {
  if (!server) return { avatar: null, banner: null };
  const picture = (url: string | null, kind: string | null | undefined) => (url && (kind === undefined || kind === null || kind === "image") ? (resolveAssetUrl(url) ?? null) : null);
  return { avatar: picture(server.avatar_url, server.avatar_kind), banner: picture(server.banner_url, server.banner_kind) };
}

/** What the server is called for colour and style purposes: its address, the same on every client. */
export const serverIdentityId = (server: Pick<ServerInfo, "server_id" | "server_name"> | undefined): string =>
  getStoredInstance()?.raw ?? server?.server_id ?? server?.server_name ?? "pufferblow";

export interface ServerAppearance {
  id: string;
  look: ServerLook;
  avatar: string | null;
  banner: string | null;
}

/** The server as the owner made it look: its icon, colours and banner. */
export function useServerAppearance(): ServerAppearance {
  const { data: server } = useServerInfo();
  const id = serverIdentityId(server);
  const choice = server?.look as ServerLookChoice | undefined;
  return { id, look: serverLookOf(id, choice), ...serverPictures(server) };
}
