import type { Attachment } from "../messages/types";

/**
 * A call's line in a conversation. The server keeps it as a message with one attachment of type `call`, so it is
 * stored, listed and delivered like any message; this is how the client reads it back.
 */
export type CallOutcome = "completed" | "missed" | "cancelled" | "declined";

export interface CallLog {
  callId: string;
  callerId: string;
  calleeId: string;
  callerName: string;
  calleeName: string;
  outcome: CallOutcome;
  durationSeconds: number;
}

const OUTCOMES: readonly CallOutcome[] = ["completed", "missed", "cancelled", "declined"];
const str = (value: unknown) => (typeof value === "string" ? value : "");

/** The call a message's attachments describe, or null when they do not describe one. */
export function callLogOf(attachments: readonly Attachment[] | undefined): CallLog | null {
  const entry = (attachments ?? []).find((a) => a.type === "call") as (Attachment & { call?: Record<string, unknown> }) | undefined;
  const call = entry?.call;
  if (!call || typeof call !== "object") return null;
  const outcome = OUTCOMES.find((o) => o === call.outcome);
  if (!outcome) return null;
  return {
    callId: str(call.call_id),
    callerId: str(call.caller_id),
    calleeId: str(call.callee_id),
    callerName: str(call.caller_name) || "Someone",
    calleeName: str(call.callee_name) || "them",
    outcome,
    durationSeconds: typeof call.duration_seconds === "number" && call.duration_seconds > 0 ? Math.floor(call.duration_seconds) : 0,
  };
}

/** `4350` becomes `1 hr 12 min`; `200` becomes `3 min 20 sec`; `45` becomes `45 sec`. Seconds drop out once an hour is in. */
export function formatCallLength(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const rest = total % 60;
  if (hours > 0) return minutes > 0 ? `${hours} hr ${minutes} min` : `${hours} hr`;
  if (minutes > 0) return rest > 0 ? `${minutes} min ${rest} sec` : `${minutes} min`;
  return `${rest} sec`;
}

export interface CallLine {
  title: string;
  detail?: string;
  /** `missed` is drawn in the warning colour: a call you did not get. */
  tone: "ok" | "missed" | "quiet";
  icon: "incoming" | "outgoing" | "missed" | "declined";
}

/** The words for a call, as the person reading it should see them. */
export function describeCall(log: CallLog, viewerId: string | undefined): CallLine {
  const iCalled = viewerId !== undefined && viewerId === log.callerId;
  switch (log.outcome) {
    case "completed":
      return {
        title: iCalled ? `You called ${log.calleeName}` : `${log.callerName} called you`,
        detail: `Lasted ${formatCallLength(log.durationSeconds)}`,
        tone: "ok",
        icon: iCalled ? "outgoing" : "incoming",
      };
    case "declined":
      return iCalled
        ? { title: `You called ${log.calleeName}`, detail: `${log.calleeName} declined`, tone: "quiet", icon: "declined" }
        : { title: `You declined a call from ${log.callerName}`, tone: "quiet", icon: "declined" };
    case "cancelled":
      return iCalled
        ? { title: `You called ${log.calleeName}`, detail: "You hung up before they answered", tone: "quiet", icon: "outgoing" }
        : { title: `Missed call from ${log.callerName}`, detail: "They hung up before you answered", tone: "missed", icon: "missed" };
    case "missed":
      return iCalled
        ? { title: `You called ${log.calleeName}`, detail: "No answer", tone: "quiet", icon: "outgoing" }
        : { title: `Missed call from ${log.callerName}`, tone: "missed", icon: "missed" };
  }
}
