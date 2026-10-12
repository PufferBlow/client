import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  acceptFriendRequest,
  listBlocks,
  listFriendRequests,
  listFriends,
  removeFriend,
  removeFriendRequest,
  sendFriendRequest,
  unblockUser,
} from "./api";

export const friendKeys = {
  all: ["friends"] as const,
  list: ["friends", "list"] as const,
  requests: ["friends", "requests"] as const,
  blocks: ["friends", "blocks"] as const,
};

export const useFriends = () => useQuery({ queryKey: friendKeys.list, queryFn: listFriends, staleTime: 30_000 });
export const useFriendRequests = () => useQuery({ queryKey: friendKeys.requests, queryFn: listFriendRequests, staleTime: 30_000 });
export const useBlocks = () => useQuery({ queryKey: friendKeys.blocks, queryFn: listBlocks, staleTime: 30_000 });

/** A mutation that refreshes every friends query when it succeeds. */
function useFriendMutation<TVariables>(mutationFn: (variables: TVariables) => Promise<void>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: friendKeys.all }),
  });
}

export const useSendFriendRequest = () => useFriendMutation(sendFriendRequest);
export const useAcceptFriendRequest = () => useFriendMutation(acceptFriendRequest);
export const useRemoveFriendRequest = () => useFriendMutation(removeFriendRequest);
export const useRemoveFriend = () => useFriendMutation(removeFriend);
export const useUnblockUser = () => useFriendMutation(unblockUser);
