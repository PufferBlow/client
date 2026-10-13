import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, KeyRound, Loader2, LogIn, RotateCw, WifiOff } from "lucide-react";
import { Button } from "../ui/Button";
import { PufferblowBrand } from "../ui/PufferblowBrand";
import { api, ApiError } from "../../services/api";
import { clearAuthToken } from "../../services/auth";
import { getApiUrl, getStoredInstance } from "../../services/instance";
import { setInstanceStatus, type InstanceStatus } from "../../features/instance/status";
import { buildAuthRedirectPath } from "../../utils/authRedirect";

/** Seconds to wait before each reconnect attempt; the last one repeats. */
const BACKOFF_SECONDS = [2, 4, 8, 15, 30];
const PROBE_TIMEOUT_MS = 5_000;

const delayFor = (attempt: number) => (BACKOFF_SECONDS[Math.min(attempt, BACKOFF_SECONDS.length - 1)] ?? 30) * 1000;

/** True when the instance answers at all; an HTTP error still means it's up. */
async function instanceAnswers(): Promise<boolean> {
  const instance = getStoredInstance();
  if (!instance) return false;
  try {
    await api.get(`${getApiUrl(instance)}/api/v1/system/server-info`, { timeout: PROBE_TIMEOUT_MS });
    return true;
  } catch (error) {
    return error instanceof ApiError && error.status !== 0;
  }
}

/** Probes the instance on a backoff schedule (and when the browser comes back online) until it answers. */
function useReconnect(onBack: () => void) {
  const [phase, setPhase] = useState<{ kind: "waiting"; until: number } | { kind: "checking" }>(() => ({
    kind: "waiting",
    until: Date.now() + delayFor(0),
  }));
  const [now, setNow] = useState(() => Date.now());
  const attempts = useRef(0);
  const inFlight = useRef(false);
  const onBackRef = useRef(onBack);
  useEffect(() => {
    onBackRef.current = onBack;
  });

  const check = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    setPhase({ kind: "checking" });
    const back = await instanceAnswers();
    inFlight.current = false;
    if (back) {
      onBackRef.current();
      return;
    }
    attempts.current += 1;
    setPhase({ kind: "waiting", until: Date.now() + delayFor(attempts.current) });
  }, []);

  useEffect(() => {
    if (phase.kind !== "waiting") return;
    const tick = setInterval(() => setNow(Date.now()), 1000);
    const due = setTimeout(() => void check(), Math.max(0, phase.until - Date.now()));
    return () => {
      clearInterval(tick);
      clearTimeout(due);
    };
  }, [phase, check]);

  useEffect(() => {
    const online = () => void check();
    window.addEventListener("online", online);
    return () => window.removeEventListener("online", online);
  }, [check]);

  const secondsLeft = phase.kind === "waiting" ? Math.max(1, Math.ceil((phase.until - now) / 1000)) : 0;
  return { checking: phase.kind === "checking", secondsLeft, retryNow: () => void check() };
}

function useOnline() {
  const [online, setOnline] = useState(() => (typeof navigator === "undefined" ? true : navigator.onLine !== false));
  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return online;
}

/**
 * Full-window screen shown over the dashboard when the instance as a whole can't be used: it
 * stopped answering (reconnects by itself) or it no longer accepts this session (sign in again).
 * The dashboard stays mounted underneath, so it comes back as it was.
 */
export function InstanceUnavailable({ status }: { status: Exclude<InstanceStatus, "ok"> }) {
  const host = getStoredInstance()?.raw ?? "your instance";
  return (
    <section
      role="alertdialog"
      aria-modal="true"
      aria-labelledby="instance-status-title"
      aria-describedby="instance-status-body"
      className="absolute inset-0 z-50 flex items-center justify-center overflow-y-auto bg-background px-6 py-10"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_40%,rgba(227,174,79,0.07),transparent_55%)]" />
      <div className="relative flex w-full max-w-[440px] flex-col items-center text-center">
        {status === "unreachable" ? <Unreachable host={host} /> : <SignedOut host={host} />}
      </div>
    </section>
  );
}

function Emblem({ badge, tone, busy }: { badge: ReactNode; tone: "error" | "primary"; busy?: boolean }) {
  const ring = tone === "error" ? "border-error/40 text-error" : "border-primary/40 text-primary";
  return (
    <div className="relative grid size-24 place-items-center rounded-full border border-border-secondary bg-surface-secondary">
      {busy && <span aria-hidden="true" className="absolute inset-0 animate-ping rounded-full border border-primary/30" />}
      <PufferblowBrand size={52} tone="paper" className="opacity-80" />
      <span className={`absolute -bottom-1 -right-1 grid size-9 place-items-center rounded-full border-2 bg-background ${ring}`}>{badge}</span>
    </div>
  );
}

function InstanceChip({ host }: { host: string }) {
  return (
    <span className="mt-5 inline-flex max-w-full items-center gap-1.5 rounded-full border border-border-secondary bg-surface px-3 py-1 text-[12.5px] text-text-tertiary">
      <Globe size={13} aria-hidden="true" className="shrink-0" />
      <span className="truncate">{host}</span>
    </span>
  );
}

function Unreachable({ host }: { host: string }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const online = useOnline();
  const { checking, secondsLeft, retryNow } = useReconnect(() => {
    setInstanceStatus("ok");
    void queryClient.invalidateQueries();
  });

  const signOut = () => {
    // Local only: the instance isn't answering, so there is no one to revoke the token with.
    clearAuthToken();
    queryClient.clear();
    setInstanceStatus("ok");
    navigate("/login", { replace: true });
  };

  return (
    <>
      <Emblem badge={<WifiOff size={16} />} tone="error" busy={checking} />
      <h1 id="instance-status-title" className="m-0 mt-7 font-display text-[28px] font-normal leading-tight text-text">
        {online ? "Can't reach your instance" : "You're offline"}
      </h1>
      <p id="instance-status-body" className="m-0 mt-2.5 text-[14.5px] leading-relaxed text-text-secondary">
        {online
          ? "It isn't responding. It may be restarting or down, or something between you and it is. Pufferblow reconnects on its own as soon as it's back."
          : "Check your internet connection. Pufferblow reconnects on its own once you're back online."}
      </p>
      <InstanceChip host={host} />
      <p aria-live="polite" className="m-0 mt-5 flex h-5 items-center gap-2 text-[13px] text-text-muted">
        {checking ? (
          <>
            <Loader2 size={14} className="animate-spin" aria-hidden="true" />
            Checking…
          </>
        ) : (
          <>Trying again in {secondsLeft}s</>
        )}
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Button autoFocus onClick={retryNow} disabled={checking}>
          <RotateCw size={15} aria-hidden="true" />
          Retry now
        </Button>
        <Button variant="ghost" onClick={signOut}>
          Sign out
        </Button>
      </div>
    </>
  );
}

function SignedOut({ host }: { host: string }) {
  const navigate = useNavigate();
  const { pathname, search, hash } = useLocation();

  const signIn = () => {
    clearAuthToken();
    setInstanceStatus("ok");
    navigate(buildAuthRedirectPath(pathname, search, hash), { replace: true });
  };

  return (
    <>
      <Emblem badge={<KeyRound size={16} />} tone="primary" />
      <h1 id="instance-status-title" className="m-0 mt-7 font-display text-[28px] font-normal leading-tight text-text">
        Your session has ended
      </h1>
      <p id="instance-status-body" className="m-0 mt-2.5 text-[14.5px] leading-relaxed text-text-secondary">
        Your sign-in expired or was revoked. Sign in again to pick up right where you left off.
      </p>
      <InstanceChip host={host} />
      <div className="mt-7 flex flex-wrap items-center justify-center gap-2">
        <Button autoFocus size="lg" onClick={signIn}>
          <LogIn size={16} aria-hidden="true" />
          Sign in again
        </Button>
      </div>
    </>
  );
}
