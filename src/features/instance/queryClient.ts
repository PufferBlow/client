import { MutationCache, QueryCache, QueryClient } from "@tanstack/react-query";
import { reportRequestError, reportRequestSuccess } from "./status";
import { ApiError } from "../../services/api";

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
        // A server under load answers late, or drops a connection, and then answers: asking again a moment later
        // usually works, so a request that got no answer is retried a few times with growing waits before it counts
        // as failed. Anything the server did answer (a refusal, a missing thing) is not retried.
        retry: (failureCount, error) => {
          if (error instanceof ApiError) {
            if (error.code === "network" || error.code === "timeout") return failureCount < 3;
            if (error.status >= 400 && error.status < 500) return false;
          }
          return failureCount < 1;
        },
        retryDelay: (attempt) => Math.min(1_000 * 2 ** attempt, 8_000),
        refetchOnWindowFocus: false,
      },
    },
  });
  return client;
}
