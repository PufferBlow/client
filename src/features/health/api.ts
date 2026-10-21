import { api } from "../../services/api";
import { authed, requireSession } from "../../services/authed";
import type { InstanceHealth, PublicHealth } from "./types";

export async function getInstanceHealth(): Promise<InstanceHealth> {
  const { health } = await authed.query<{ health: InstanceHealth }>("GET", "/api/v1/system/health");
  if (!health) throw new Error("The instance returned an unexpected response.");
  return health;
}

/** The small public answer, which says only whether the instance considers itself well. */
export async function getPublicHealth(): Promise<PublicHealth> {
  const { origin } = requireSession();
  const body = await api.get<{ status?: string }>(`${origin}/healthz`, { timeout: 6000 });
  return { status: body?.status === "ok" ? "ok" : "degraded" };
}
