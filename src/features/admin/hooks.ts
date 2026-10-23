import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { serverKeys } from "../server/hooks";
import { userKeys } from "../users/hooks";
import * as api from "./api";
import { moderationStates } from "./moderation";

export const adminKeys = {
  roles: ["admin", "roles"] as const,
  privileges: ["admin", "privileges"] as const,
  reports: ["admin", "reports"] as const,
  audit: ["admin", "audit"] as const,
  blockedIps: ["admin", "blocked-ips"] as const,
};

const NO_RETRY = { retry: false, staleTime: 15_000 } as const;

export const useRoles = () => useQuery({ queryKey: adminKeys.roles, queryFn: api.listRoles, ...NO_RETRY });
export const usePrivileges = () => useQuery({ queryKey: adminKeys.privileges, queryFn: api.listPrivileges, ...NO_RETRY });
export const useReports = () => useQuery({ queryKey: adminKeys.reports, queryFn: () => api.listReports(), ...NO_RETRY });
export const useAudit = () => useQuery({ queryKey: adminKeys.audit, queryFn: () => api.listAudit(), ...NO_RETRY });
export const useBlockedIps = () => useQuery({ queryKey: adminKeys.blockedIps, queryFn: api.listBlockedIps, ...NO_RETRY });

/** Who is banned or timed out, from the audit log. */
export function useModerationStates() {
  const { data, ...rest } = useAudit();
  return { ...rest, data: data ? moderationStates(data) : undefined };
}

/** Every change to roles and to who holds them; each refreshes what depends on it. */
export function useRoleAdmin() {
  const queryClient = useQueryClient();
  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: adminKeys.roles }),
      queryClient.invalidateQueries({ queryKey: adminKeys.audit }),
      queryClient.invalidateQueries({ queryKey: userKeys.list }),
      queryClient.invalidateQueries({ queryKey: userKeys.profile }),
    ]);
  return {
    create: useMutation({ mutationFn: api.createRole, onSuccess: refresh }),
    update: useMutation({
      mutationFn: ({ roleId, ...role }: { roleId: string; role_name: string; privileges_ids: string[] }) => api.updateRole(roleId, role),
      onSuccess: refresh,
    }),
    remove: useMutation({ mutationFn: api.deleteRole, onSuccess: refresh }),
    assign: useMutation({ mutationFn: ({ userId, rolesIds }: { userId: string; rolesIds: string[] }) => api.setUserRoles(userId, rolesIds), onSuccess: refresh }),
  };
}

/** Ban, timeout and report actions. The audit log is where they show up, so it is refreshed after each. */
export function useModerationAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: adminKeys.audit }), queryClient.invalidateQueries({ queryKey: adminKeys.reports })]);
  return {
    ban: useMutation({ mutationFn: ({ userId, reason }: { userId: string; reason?: string }) => api.banUser(userId, reason), onSuccess: refresh }),
    unban: useMutation({ mutationFn: api.unbanUser, onSuccess: refresh }),
    timeout: useMutation({ mutationFn: ({ userId, minutes, reason }: { userId: string; minutes: number; reason?: string }) => api.timeoutUser(userId, minutes, reason), onSuccess: refresh }),
    clearTimeout: useMutation({ mutationFn: api.clearTimeout, onSuccess: refresh }),
    resolve: useMutation({
      mutationFn: ({ reportId, action, reason }: { reportId: string; action: string; reason?: string }) => api.resolveReport(reportId, action, reason),
      onSuccess: refresh,
    }),
  };
}

export function useBlockedIpAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => queryClient.invalidateQueries({ queryKey: adminKeys.blockedIps });
  return {
    block: useMutation({ mutationFn: ({ ip, reason }: { ip: string; reason: string }) => api.blockIp(ip, reason), onSuccess: refresh }),
    unblock: useMutation({ mutationFn: api.unblockIp, onSuccess: refresh }),
  };
}

export function useServerSettingsAdmin() {
  const queryClient = useQueryClient();
  const refresh = () => Promise.all([queryClient.invalidateQueries({ queryKey: serverKeys.info }), queryClient.invalidateQueries({ queryKey: adminKeys.audit })]);
  return {
    update: useMutation({ mutationFn: api.updateServerSettings, onSuccess: refresh }),
    appearance: useMutation({ mutationFn: api.updateServerAppearance, onSuccess: refresh }),
  };
}
