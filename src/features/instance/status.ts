import { useSyncExternalStore } from "react";
import type { QueryClient } from "@tanstack/react-query";
import { ApiError } from "../../services/api";
import { renewSession } from "../../services/auth";
import { instanceAnswers } from "./probe";

/**
 * Whether the signed-in instance is usable as a whole, as opposed to one request failing:
 * `slow` when requests are not being answered (busy, or a hiccup: a small banner, everything keeps working),
 * `unreachable` when it has stayed silent through several spaced checks, `signed_out` when it no longer accepts
 * the session. The dashboard swaps to a full-window screen for the last two, instead of every panel showing its
 * own error. One slow answer must never black the app out: a server under load is slow long before it is gone.
 */
export type InstanceStatus = "ok" | "slow" | "unreachable" | "signed_out";

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

/** How long to wait before each check of an instance that stopped answering; all of them failing means it is down. */
let CHECK_DELAYS_MS = [1_500, 3_000, 6_000];
let probe: () => Promise<boolean> = instanceAnswers;
let escalation = 0;

/** For tests: shorter waits and a stand-in for the check. */
export function configureInstanceChecks(options: {
  delaysMs?: number[];
  probe?: () => Promise<boolean>;
}): void {
  if (options.delaysMs) CHECK_DELAYS_MS = options.delaysMs;
  if (options.probe) probe = options.probe;
}

/**
 * Something got no answer. Offline is plain: the screen right away. Otherwise the instance is only *slow* for now, and
 * is asked, a few times with waits between, whether it answers at all; only when it never does is it unreachable.
 * Asking again is cheap, and the cost of being wrong the other way (a full-window screen over a working app) is not.
 */
export function reportNoAnswer(): void {
  if (status === "signed_out") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) {
    escalation += 1;
    setInstanceStatus("unreachable");
    return;
  }
  if (status === "unreachable") return;
  setInstanceStatus("slow");
  void confirmUnreachable(++escalation);
}

async function confirmUnreachable(mine: number): Promise<void> {
  for (const delay of CHECK_DELAYS_MS) {
    await new Promise((resolve) => setTimeout(resolve, delay));
    if (mine !== escalation || status !== "slow") return; // it answered meanwhile, or something newer is checking
    if (await probe()) {
      if (mine === escalation && status === "slow") setInstanceStatus("ok");
      return;
    }
  }
  if (mine === escalation && status === "slow") setInstanceStatus("unreachable");
}

const isUnanswered = (error: ApiError) => error.code === "network" || error.code === "timeout";
const isSessionRejected = (error: ApiError) =>
  error.code === "auth.invalid_token" || error.code === "auth.token_required";

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
    reportNoAnswer();
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
          if (outcome === "unreachable") reportNoAnswer();
          else setInstanceStatus("signed_out");
        }
      })
      .finally(() => {
        renewing = null;
      });
  }
}

/** Any answer from the instance means it is reachable again. */
export function reportRequestSuccess(): void {
  if (status === "unreachable" || status === "slow") {
    escalation += 1;
    setInstanceStatus("ok");
  }
}

/** For tests: back to a clean slate. */
export function resetInstanceStatus(): void {
  status = "ok";
  escalation += 1;
  CHECK_DELAYS_MS = [1_500, 3_000, 6_000];
  probe = instanceAnswers;
  renewing = null;
  lastRenewedAt = 0;
  listeners.forEach((listener) => listener());
}
