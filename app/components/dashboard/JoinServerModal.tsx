import { useState } from "react";

import {
  joinServer,
  JoinServerError,
  type JoinedServerInfo,
} from "../../services/joinedServers";
import { getAuthTokenFromCookies } from "../../services/user";
import { logger } from "../../utils/logger";

interface JoinServerModalProps {
  /** Set true when the user clicked the rail's "+" button. */
  open: boolean;
  /** Called whether the user cancels or finishes a join. */
  onClose: () => void;
  /** Called with the new server's info after a successful join so the
   *  rail can splice it into the joined list without a refetch. */
  onJoined: (server: JoinedServerInfo) => void;
}

/**
 * Modal for joining a remote Pufferblow instance.
 *
 * The flow is intentionally one-field: the user pastes a host:port
 * (or a full URL — we normalize) and the home server does the
 * probe. Any validation feedback (unreachable, not Pufferblow,
 * already joined) comes back as a structured error code from the
 * home server, and this dialog branches on that code so the user
 * sees a copy that explains exactly what went wrong rather than a
 * generic "failed" toast.
 *
 * Modal chrome: a centered card backed by a half-opaque background.
 * Escape and click-outside both close. No focus trap — the modal
 * has a single input plus two buttons, so keyboard nav is small
 * enough to live without a full trap.
 */
export function JoinServerModal({ open, onClose, onJoined }: JoinServerModalProps) {
  const [target, setTarget] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    const cleaned = target.trim();
    if (!cleaned) {
      setError("Enter the instance address.");
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      const authToken = getAuthTokenFromCookies();
      if (!authToken) {
        setError("You're not signed in. Reload the app and try again.");
        return;
      }
      const info = await joinServer(authToken, cleaned);
      logger.ui.info("Joined server", { server_id: info.server_id });
      onJoined(info);
      setTarget("");
      onClose();
    } catch (e) {
      if (e instanceof JoinServerError) {
        setError(_messageForCode(e.code, e.message));
      } else {
        setError(e instanceof Error ? e.message : "Could not join that instance.");
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      // Click-outside guard: the outer overlay closes; the inner
      // card stops propagation so clicks INSIDE the card don't
      // dismiss it. The button group inside the card handles its
      // own onClick so cancel + submit work normally.
      role="dialog"
      aria-modal="true"
      aria-labelledby="join-server-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
      onKeyDown={(e) => {
        if (e.key === "Escape") onClose();
      }}
    >
      <form
        onSubmit={handleSubmit}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-6 shadow-2xl"
      >
        <h2
          id="join-server-title"
          className="text-lg font-semibold text-[var(--color-text)]"
        >
          Join a server
        </h2>
        <p className="mt-1 text-sm text-[var(--color-text-secondary)]">
          Enter the address of the Pufferblow instance you want to follow.
          Your home server will check it's reachable before adding it
          to your list.
        </p>

        <label className="mt-4 block">
          <span className="block text-xs font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
            Instance address
          </span>
          <input
            type="text"
            autoFocus
            value={target}
            onChange={(e) => setTarget(e.target.value)}
            disabled={submitting}
            placeholder="chat.example.com:7575"
            className="mt-1 w-full rounded-md border border-[var(--color-border)] bg-[var(--color-surface-secondary)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/20 disabled:opacity-50"
          />
          <span className="mt-1 block text-[11px] text-[var(--color-text-muted)]">
            Use the host and port — http:// or https:// is fine too.
          </span>
        </label>

        {error && (
          <div
            role="alert"
            className="mt-3 rounded-md border border-[var(--color-error)]/40 bg-[var(--color-error)]/10 px-3 py-2 text-xs text-[var(--color-error)]"
          >
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-md border border-transparent px-4 py-2 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="rounded-md border border-[var(--color-primary)] bg-[var(--color-primary)] px-4 py-2 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Joining…" : "Join"}
          </button>
        </div>
      </form>
    </div>
  );
}

/**
 * Map a structured error code from the home server's response to a
 * sentence the user can act on. Falls back to the server's own
 * message if the code is unknown — that's always at least the raw
 * HTTPException detail.
 */
function _messageForCode(code: string, fallback: string): string {
  switch (code) {
    case "unreachable":
      return "Could not reach that instance. Check the address and try again.";
    case "not_pufferblow":
      return "That host answered but doesn't look like a Pufferblow instance.";
    case "self_join":
      return "That's your own home instance — you're already on it.";
    case "invalid_target":
      return "The instance address looks malformed.";
    default:
      return fallback;
  }
}
