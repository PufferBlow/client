import { useQuery } from "@tanstack/react-query";
import { getMyProfile, listUsers } from "./api";

export const userKeys = {
  profile: ["profile"] as const,
  list: ["users", "list"] as const,
};

export function useMyProfile() {
  return useQuery({ queryKey: userKeys.profile, queryFn: getMyProfile, staleTime: 60_000 });
}

export function useUsers() {
  return useQuery({ queryKey: userKeys.list, queryFn: listUsers, staleTime: 60_000 });
}
