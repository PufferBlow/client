import { useEffect, useState } from "react";
import { Lock, Mic, MicOff, Phone, PhoneOff, ShieldAlert, ShieldCheck } from "lucide-react";
import { useCall } from "../../features/calls/callContext";
import type { Encryption } from "../../features/calls/types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Avatar } from "./Avatar";

const iconButton =
  "grid size-10 place-items-center rounded-full border-0 text-text transition-colors focus-visible:outline-2 focus-visible:outline-focus";

function Timer({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const seconds = since === null ? 0 : Math.max(0, Math.floor((now - since) / 1000));
  const minutes = Math.floor(seconds / 60);
  return <span className="tabular-nums">{`${minutes}:${String(seconds % 60).padStart(2, "0")}`}</span>;
}

/** What protects the call, in a sentence and a mark. Never claims more than the checks established. */
function Protection({ encryption, route, onOpenSafety }: { encryption: Encryption; route: "direct" | "relay"; onOpenSafety: () => void }) {
  if (encryption.status === "protected") {
    const verified = encryption.trust === "verified";
    const Icon = verified ? ShieldCheck : Lock;
    return (
      <button
        type="button"
        onClick={onOpenSafety}
        className={`inline-flex items-center gap-1.5 border-0 bg-transparent p-0 text-[12px] font-semibold ${verified ? "text-success" : "text-text-tertiary"} hover:text-text`}
        aria-label={verified ? "End-to-end encrypted and verified. Show safety number" : "End-to-end encrypted, not verified yet. Show safety number"}
      >
        <Icon size={13} aria-hidden="true" />
        {verified ? "End-to-end encrypted · verified" : "End-to-end encrypted · not verified"}
        {route === "relay" && " · via server"}
      </button>
    );
  }
  if (encryption.status === "failed") {
    return (
      <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-error-text">
        <ShieldAlert size={13} aria-hidden="true" /> Not protected
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] text-text-tertiary">
      <Lock size={13} aria-hidden="true" /> Securing the call…
    </span>
  );
}

/**
 * The call, wherever you are in the app: a card at the top of the window that rings, shows who is
 * on the line and how it is protected, and asks before trusting a key it has not seen.
 */
export function CallOverlay() {
  const call = useCall();
  const [safetyOpen, setSafetyOpen] = useState(false);

  if (call.phase === "ended" && !call.error) return null;

  const card = "fixed left-1/2 top-3 z-40 w-[min(380px,calc(100vw-1.5rem))] -translate-x-1/2 rounded-2xl bg-surface-tertiary p-3.5 shadow-modal";
  const person = (
    <div className="flex min-w-0 items-center gap-3">
      <Avatar name={call.peerName} seed={call.peerId ?? call.peerName} size={44} speaking={call.phase === "connected"} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-bold">{call.peerName}</div>
      </div>
    </div>
  );

  if (call.phase === "failed" || call.phase === "ended") {
    return (
      <div role="alert" className={card}>
        <div className="flex items-center gap-3">
          <ShieldAlert size={18} className="shrink-0 text-error" aria-hidden="true" />
          <span className="min-w-0 flex-1 text-[13.5px] leading-snug">{call.error}</span>
          <Button size="sm" variant="secondary" onClick={call.dismiss}>
            Dismiss
          </Button>
        </div>
      </div>
    );
  }

  if (call.encryption.status === "key_changed") {
    return (
      <div role="alertdialog" aria-label="Security key changed" className={card}>
        {person}
        <p className="mb-3 mt-3 text-[13px] leading-snug text-text-body">
          {call.peerName}'s security key is not the one you have seen before. It may be a new device of theirs, or someone sitting between you. Compare safety numbers with them
          before you carry on.
        </p>
        <div className="flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => call.resolveKeyChange(false)}>
            End call
          </Button>
          <Button variant="secondary" className="flex-1" onClick={() => call.resolveKeyChange(true)}>
            Trust new key
          </Button>
        </div>
      </div>
    );
  }

  if (call.phase === "incoming") {
    return (
      <div role="alertdialog" aria-label={`Incoming call from ${call.peerName}`} className={card}>
        {person}
        <div className="mt-1 text-[12.5px] text-text-tertiary">is calling you · end-to-end encrypted</div>
        <div className="mt-3 flex gap-2">
          <Button variant="danger" className="flex-1" onClick={() => void call.decline()}>
            <PhoneOff size={16} aria-hidden="true" /> Decline
          </Button>
          <Button variant="success" className="flex-1" onClick={() => void call.accept()}>
            <Phone size={16} aria-hidden="true" /> Accept
          </Button>
        </div>
      </div>
    );
  }

  const status = call.phase === "calling" ? "Calling…" : call.phase === "connecting" ? "Connecting…" : null;
  return (
    <>
      <div role="status" aria-label={`Call with ${call.peerName}`} className={card}>
        <div className="flex items-center gap-3">
          <div className="min-w-0 flex-1">
            {person}
            <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1">
              <span className="text-[12.5px] text-text-tertiary">{status ?? <Timer since={call.connectedAt} />}</span>
              <Protection encryption={call.encryption} route={call.route} onOpenSafety={() => setSafetyOpen(true)} />
            </div>
          </div>
          {call.phase === "connected" && (
            <button
              type="button"
              className={`${iconButton} ${call.muted ? "bg-error/14 text-error-text" : "bg-surface-secondary hover:bg-surface"}`}
              aria-label={call.muted ? "Unmute" : "Mute"}
              aria-pressed={call.muted}
              onClick={call.toggleMute}
            >
              {call.muted ? <MicOff size={17} /> : <Mic size={17} />}
            </button>
          )}
          <button type="button" className={`${iconButton} bg-error/14 text-error-text hover:bg-error/22`} aria-label={call.phase === "calling" ? "Cancel call" : "Hang up"} onClick={() => void call.hangUp()}>
            <PhoneOff size={17} />
          </button>
        </div>
      </div>

      <Modal
        isOpen={safetyOpen && call.encryption.status === "protected"}
        onClose={() => setSafetyOpen(false)}
        title="Safety number"
        description={`If ${call.peerName} reads you the same digits (in person, or over another app), nobody can be listening in between you.`}
        size="md"
        footer={
          <>
            <Button variant="ghost" onClick={() => setSafetyOpen(false)}>
              Close
            </Button>
            {call.encryption.status === "protected" && call.encryption.trust !== "verified" && (
              <Button
                onClick={() => {
                  call.markVerified();
                  setSafetyOpen(false);
                }}
              >
                They match
              </Button>
            )}
          </>
        }
      >
        {call.encryption.status === "protected" && (
          <p aria-label="Safety number" className="m-0 grid grid-cols-4 gap-x-4 gap-y-2 text-center font-mono text-[17px] tabular-nums">
            {call.encryption.safetyNumber.split(" ").map((group, index) => (
              <span key={index}>{group}</span>
            ))}
          </p>
        )}
      </Modal>
    </>
  );
}
