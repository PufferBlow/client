import { Phone, PhoneIncoming, PhoneMissed, PhoneOff, PhoneOutgoing } from "lucide-react";
import { describeCall, type CallLog } from "../../features/calls/log";
import type { Message } from "../../features/messages/types";

const ICONS = { incoming: PhoneIncoming, outgoing: PhoneOutgoing, missed: PhoneMissed, declined: PhoneOff } as const;

const formatWhen = (iso: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const time = date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const days = Math.round((new Date().setHours(0, 0, 0, 0) - new Date(date).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return time;
  if (days === 1) return `Yesterday at ${time}`;
  return `${date.toLocaleDateString([], { month: "short", day: "numeric" })} at ${time}`;
};

/** A call's line in a conversation: who called, how it ended, and how long it lasted if it was picked up. */
export function CallLogRow({ message, log, myUserId }: { message: Message; log: CallLog; myUserId: string | undefined }) {
  const line = describeCall(log, myUserId);
  const Icon = ICONS[line.icon] ?? Phone;
  const missed = line.tone === "missed";
  return (
    <div data-message-id={message.id} data-call-log={log.outcome} tabIndex={0} className="mx-4 my-1.5 flex items-center gap-3 rounded-lg px-1 py-1.5 outline-none focus-visible:bg-text/[0.05]">
      <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-full ${missed ? "bg-error/14 text-error-text" : "bg-surface-secondary text-text-tertiary"}`}>
        <Icon size={18} />
      </span>
      <div className="min-w-0 flex-1 leading-snug">
        <p className={`m-0 text-[14.5px] ${missed ? "font-semibold text-error-text" : "text-text-secondary"}`}>{line.title}</p>
        {line.detail && <p className="m-0 text-[12.5px] text-text-muted">{line.detail}</p>}
      </div>
      <time dateTime={message.sentAt} className="shrink-0 text-[11.5px] text-text-muted">
        {formatWhen(message.sentAt)}
      </time>
    </div>
  );
}
