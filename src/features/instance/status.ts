import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../services/api";
import { renewSession } from "../../services/auth";

/**
 * Whether the signed-in instance is usable as a whole, as opposed to one request failing:
 * `unreachable` when it stops answering, `signed_out` when it no longer accepts the session.
 * The dashboard swaps to a full-window screen for either, instead of every panel showing its
 * own error.
 */
export type InstanceStatus = "ok" | "unreachable" | "signed_out";

let status: InstanceStatus = "ok";
const listeners = new Set<() => void>();

export function getInstanceStatus(): InstanceStatus {
  return status;
}

export function setInstanceStatus(next: InstanceStatus): void {
  if (next === status) return;
  status = next;
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useInstanceStatus(): InstanceStatus {
  return useSyncExternalStore(subscribe, getInstanceStatus, getInstanceStatus);
}

const isUnanswered = (error: ApiError) => error.code === "network" || error.code === "timeout";
const isSessionRejected = (error: ApiError) => error.code === "auth.invalid_token" || error.code === "auth.token_required";

/** A refresh that worked this recently, yet the instance still refuses the token: give up. */
const REFRESH_LOOP_WINDOW_MS = 30_000;
let renewing: Promise<void> | null = null;
let lastRenewedAt = 0;

/**
 * Feeds a failed request into the instance status. A refused session is first renewed
 * silently (and everything refetched with the new token); only when that fails is the user
 * signed out. Other errors are left to the view that made the request.
 */
export function reportRequestError(error: unknown, queryClient: QueryClient): void {
  if (!(error instanceof ApiError) || status === "signed_out") return;

  if (isUnanswered(error)) {
    setInstanceStatus("unreachable");
    return;
  }

  if (isSessionRejected(error)) {
    if (Date.now() - lastRenewedAt < REFRESH_LOOP_WINDOW_MS) {
      setInstanceStatus("signed_out");
      return;
    }
    renewing ??= renewSession()
      .then((outcome) => {
        if (outcome === "renewed") {
          lastRenewedAt = Date.now();
          setInstanceStatus("ok");
          void queryClient.invalidateQueries();
        } else {
          setInstanceStatus(outcome === "unreachable" ? "unreachable" : "signed_out");
        }
      })
      .finally(() => {
        renewing = null;
      });
  }
}

/** Any answer from the instance means it is reachable again. */
export function reportRequestSuccess(): void {
  if (status === "unreachable") setInstanceStatus("ok");
}

/** For tests: back to a clean slate. */
export function resetInstanceStatus(): void {
  status = "ok";
  renewing = null;
  lastRenewedAt = 0;
  listeners.forEach((listener) => listener());
}
