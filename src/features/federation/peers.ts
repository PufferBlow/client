import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "../../services/authed";

const FEDERATION = "/api/v1/federation";

export type PeerStatus = "federating" | "pending" | "limited" | "blocked";
export type FederationMode = "open" | "allowlist" | "closed";
export type PolicyKey = "media" | "voice" | "discover";

export const PEER_STATUSES: readonly PeerStatus[] = ["federating", "pending", "limited", "blocked"];
export const FEDERATION_MODES: readonly FederationMode[] = ["open", "allowlist", "closed"];

export interface Peer {
  host: string;
  status: PeerStatus;
  /** What is in force now: the status's defaults with anything set by hand on top. */
  policy: Record<PolicyKey, boolean>;
  software: string | null;
  version: string | null;
  users: number | null;
  follows: number;
  last_activity: string | null;
  last_delivery_at: string | null;
  last_delivery_ok: boolean | null;
  latency_ms: number | null;
}

export interface PeerList {
  mode: FederationMode;
  counts: Record<PeerStatus, number>;
  peers: Peer[];
}

export interface ImportResult {
  added: string[];
  skipped: string[];
  invalid: string[];
}

export const peerKeys = { list: ["federation", "peers"] as const };

export async function listPeers(): Promise<PeerList> {
  const body = await authed.query<Partial<PeerList>>("GET", `${FEDERATION}/peers`);
  return {
    mode: body.mode ?? "open",
    counts: { federating: 0, pending: 0, limited: 0, blocked: 0, ...body.counts },
    peers: body.peers ?? [],
  };
}

/** Admins and the owner only: the server refuses everyone else. */
export function usePeers() {
  return useQuery({ queryKey: peerKeys.list, queryFn: listPeers, staleTime: 15_000, retry: false });
}

const hostPath = (host: string) => encodeURIComponent(host);

/** Every change to the peers and the mode; each refreshes the list so the screen shows what the server decided. */
export function usePeerAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: peerKeys.list });

  const setMode = useMutation({ mutationFn: (mode: FederationMode) => authed.body("PUT", `${FEDERATION}/mode`, { mode }), onSuccess: refresh });
  const add = useMutation({
    mutationFn: ({ host, status }: { host: string; status: PeerStatus }) => authed.body("POST", `${FEDERATION}/peers`, { host, status }),
    onSuccess: refresh,
  });
  const setStatus = useMutation({
    mutationFn: ({ host, status }: { host: string; status: PeerStatus }) => authed.body("PUT", `${FEDERATION}/peers/${hostPath(host)}/status`, { status }),
    onSuccess: refresh,
  });
  const setPolicy = useMutation({
    mutationFn: ({ host, policy }: { host: string; policy: Partial<Record<PolicyKey, boolean>> }) =>
      authed.body("PUT", `${FEDERATION}/peers/${hostPath(host)}/policy`, { policy }),
    onSuccess: refresh,
  });
  const remove = useMutation({ mutationFn: (host: string) => authed.query("DELETE", `${FEDERATION}/peers/${hostPath(host)}`), onSuccess: refresh });
  const checkNow = useMutation({
    mutationFn: async (host: string) => (await authed.body<{ found: boolean }>("POST", `${FEDERATION}/peers/${hostPath(host)}/refresh`)).found,
    onSuccess: refresh,
  });
  const importHosts = useMutation({
    mutationFn: (args: { hosts: string[]; status: PeerStatus }) => authed.body<ImportResult>("POST", `${FEDERATION}/peers/import`, args),
    onSuccess: refresh,
  });

  return { setMode, add, setStatus, setPolicy, remove, checkNow, importHosts };
}

/** One host per line, or separated by commas or spaces; blank lines and `#` comments are ignored. */
export function parseHostList(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((word) => word.trim())
    .filter((word) => word && !word.startsWith("#"));
}
