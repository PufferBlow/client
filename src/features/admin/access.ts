import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authed } from "../../services/authed";
import type { JoinMode } from "../server/types";

/** Who may join: invitation codes, and the requests to join that the owner and moderators decide. */

const SERVER = "/api/v1/server";

export type InviteState = "active" | "used_up" | "expired" | "revoked";

export interface Invite {
  code: string;
  created_by: string;
  note: string | null;
  max_uses: number | null;
  uses: number;
  expires_at: string | null;
  revoked_at: string | null;
  created_at: string;
  state: InviteState;
}

export interface JoinRequest {
  request_id: string;
  kind: "local" | "federated";
  user_id: string | null;
  handle: string;
  home_host: string | null;
  message: string | null;
  status: "pending" | "approved" | "denied";
  decided_by: string | null;
  decided_at: string | null;
  created_at: string;
}

export const accessKeys = {
  invites: ["admin", "invites"] as const,
  requests: ["admin", "join-requests"] as const,
  pending: ["admin", "join-requests", "pending-count"] as const,
};

/** The privileges that open this part of the control panel to someone who is not the owner. */
export const canManageInvites = (privileges: readonly string[] | undefined) => !!privileges?.includes("manage_invites");
export const canManageRequests = (privileges: readonly string[] | undefined) => !!privileges?.includes("manage_join_requests");

export function useInvites() {
  return useQuery({
    queryKey: accessKeys.invites,
    queryFn: async () => (await authed.query<{ invites: Invite[]; join_mode: JoinMode }>("GET", `${SERVER}/invites`)),
    staleTime: 15_000,
  });
}

export function useInviteAdmin() {
  const client = useQueryClient();
  const refresh = () => client.invalidateQueries({ queryKey: accessKeys.invites });
  return {
    create: useMutation({
      mutationFn: (input: { note?: string; max_uses?: number; expires_in_hours?: number }) => authed.body<{ invite: Invite }>("POST", `${SERVER}/invites`, input as Record<string, unknown>),
      onSuccess: refresh,
    }),
    revoke: useMutation({
      mutationFn: (code: string) => authed.query<unknown>("DELETE", `${SERVER}/invites/${encodeURIComponent(code)}`),
      onSuccess: refresh,
    }),
  };
}

export function useJoinRequests(status?: JoinRequest["status"]) {
  return useQuery({
    queryKey: [...accessKeys.requests, status ?? "all"],
    queryFn: () => authed.query<{ requests: JoinRequest[]; pending: number; join_mode: JoinMode }>("GET", `${SERVER}/join-requests`, status ? { query: { status } } : undefined),
    staleTime: 10_000,
  });
}

/** How many requests wait, for the badge on the navigation. Nothing is asked unless `enabled` (the person can decide them). */
export function usePendingJoinRequests(enabled: boolean) {
  return useQuery({
    queryKey: accessKeys.pending,
    queryFn: async () => (await authed.query<{ pending: number }>("GET", `${SERVER}/join-requests`, { query: { status: "pending" } })).pending,
    enabled,
    staleTime: 20_000,
    refetchInterval: 60_000,
  });
}

export function useDecideJoinRequest() {
  const client = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve }: { id: string; approve: boolean }) => authed.body<{ pending: number }>("POST", `${SERVER}/join-requests/${encodeURIComponent(id)}/${approve ? "approve" : "deny"}`),
    onSuccess: () => client.invalidateQueries({ queryKey: ["admin", "join-requests"] }),
  });
}
