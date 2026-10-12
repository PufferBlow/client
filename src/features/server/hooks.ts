import { useQuery } from "@tanstack/react-query";
import { getServerInfo } from "./api";

export const serverKeys = { info: ["server", "info"] as const };

export function useServerInfo() {
  return useQuery({ queryKey: serverKeys.info, queryFn: getServerInfo, staleTime: 5 * 60_000 });
}
