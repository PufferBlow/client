import { api } from "../../services/api";
import { requireSession } from "../../services/authed";
import type { ServerInfo } from "./types";

export async function getServerInfo(): Promise<ServerInfo> {
  const { origin } = requireSession();
  const { server_info } = await api.get<{ server_info: ServerInfo }>(`${origin}/api/v1/system/server-info`);
  if (!server_info) throw new Error("The instance returned an unexpected response.");
  return server_info;
}
