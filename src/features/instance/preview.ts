import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { api } from "../../services/api";
import { getApiUrl } from "../../services/instance";
import type { InstanceConfig } from "../../services/types";
import type { ServerInfo } from "../server/types";

/**
 * What an instance says about itself before anyone signs in: its public `server-info`. The sign-in
 * screens use it for the "Found" badge and for the art beside the form (the instance's own banner,
 * name and counts), so people see where they are going before they type a password.
 */
export async function fetchInstancePreview(instance: InstanceConfig, signal?: AbortSignal): Promise<ServerInfo> {
  const { server_info } = await api.get<{ server_info: ServerInfo }>(`${getApiUrl(instance)}/api/v1/system/server-info`, { signal, timeout: 6000 });
  if (!server_info) throw new Error("This does not look like a Pufferblow instance.");
  return server_info;
}

/** A path the instance serves (`/storage/...`, `/assets/...`) as a URL, for an instance that is not the signed-in one. */
export function previewAssetUrl(instance: InstanceConfig, path: string | null | undefined): string | undefined {
  if (!path) return undefined;
  if (/^(https?:\/\/|blob:|data:)/i.test(path)) return path;
  return `${getApiUrl(instance)}${path.startsWith("/") ? "" : "/"}${path}`;
}

/** `value`, but only once it has stopped changing for `ms`. */
export function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return settled;
}

/** The preview of `instance`, or nothing while there is none to ask. Never retries: an answer of "no" is the answer. */
export function useInstancePreview(instance: InstanceConfig | null) {
  return useQuery({
    queryKey: ["instance-preview", instance?.origin ?? null],
    queryFn: ({ signal }) => fetchInstancePreview(instance!, signal),
    enabled: instance !== null,
    retry: false,
    staleTime: 5 * 60_000,
  });
}
