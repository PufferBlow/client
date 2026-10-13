import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { reportRequestError, reportRequestSuccess } from "./status";

/** The app's query client, wired so every request's outcome updates the instance status. */
export function createAppQueryClient(): QueryClient {
  const client: QueryClient = new QueryClient({
    queryCache: new QueryCache({
      onError: (error) => reportRequestError(error, client),
      onSuccess: () => reportRequestSuccess(),
    }),
    mutationCache: new MutationCache({
      onError: (error) => reportRequestError(error, client),
      onSuccess: () => reportRequestSuccess(),
    }),
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}
