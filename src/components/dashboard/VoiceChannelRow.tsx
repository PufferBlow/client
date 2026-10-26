import { useEffect, useState, type MouseEvent } from "react";
import { ChevronDown, ChevronRight, HeadphoneOff, Loader2, MicOff, Phone, SignalHigh, Users, Volume2 } from "lucide-react";
import { useVoiceRoom } from "../../features/voice/hooks";
import { useElapsed } from "../../features/voice/useElapsed";
import { useVoice } from "../../features/voice/voiceContext";
import type { VoiceParticipant } from "../../features/voice/types";
import type { Channel } from "../../features/channels/types";
import { Avatar } from "./Avatar";

interface VoiceChannelRowProps {
  channel: Channel;
  onMenu: (channelId: string, point: { x: number; y: number }) => void;
  /** The "more" button, passed in so the row stays in step with the text channel rows. */
  moreButton: React.ReactNode;
}

function Roster({ participants }: { participants: VoiceParticipant[] }) {
  if (participants.length === 0) return null;
  return (
    <ul aria-label="In this call" className="m-0 mb-1 ml-[22px] mt-0.5 list-none space-y-px p-0">
      {participants.map((p) => (
        <li key={p.userId} className="flex h-7 items-center gap-2 rounded-md pl-2 pr-1.5 text-[13px] text-text-body">
          {/* Speaking is the only animated ring: a sage pulse. Muted or deafened is a still white ring. */}
          <span className="rounded-full" data-speaking={p.isSpeaking || undefined}>
            <Avatar name={p.username || "?"} seed={p.userId} size={22} speaking={p.isSpeaking} muted={p.isMuted || p.isDeafened} ringColor="var(--color-surface)" />
          </span>
          <span className="min-w-0 flex-1 truncate">{p.username || "Unknown"}</span>
          {p.isMuted && <MicOff size={12} aria-label="Muted" className="shrink-0 text-text-muted" />}
          {p.isDeafened && <HeadphoneOff size={12} aria-label="Deafened" className="shrink-0 text-text-muted" />}
        </li>
      ))}
    </ul>
  );
}

/**
 * A voice channel. Clicking the row only shows or hides who is in the call; the Join button is the way in, and
 * leaving is done from the call card. While exactly one person is in, a timer shows how long the channel has been busy.
 */
export function VoiceChannelRow({ channel, onMenu, moreButton }: VoiceChannelRowProps) {
  const id = channel.channel_id;
  const voice = useVoice();
  const here = voice.channelId === id;
  const connected = here && voice.status === "connected";
  const connecting = here && voice.status === "connecting";
  const [open, setOpen] = useState(true);

  // The call you are in reports its own roster; every other channel is read from the API. Both use the server's start time.
  const { data: room, refetch } = useVoiceRoom(id);
  const participants = connected ? voice.participants : (room?.participants ?? []);
  const count = participants.length;
  // Someone joining or leaving can start or end the call, so ask the server for its start time again rather than wait for the next poll.
  useEffect(() => {
    void refetch();
  }, [count, refetch]);
  const elapsed = useElapsed(count === 1 ? (room?.startedAt ?? null) : null);
  const inCall = count > 0 ? `, ${count} ${count === 1 ? "person" : "people"} in the call` : "";
  const Chevron = open ? ChevronDown : ChevronRight;

  return (
    <div
      className="group relative"
      onContextMenu={(e: MouseEvent) => {
        e.preventDefault();
        onMenu(id, { x: e.clientX, y: e.clientY });
      }}
    >
      {/* Its own box, so the buttons on the right centre on this line however long the roster below grows. */}
      <div className="relative">
        <button
          type="button"
          aria-expanded={count > 0 ? open : undefined}
          aria-label={`${channel.channel_name}${connected ? ", connected" : ""}${inCall}`}
          onClick={() => setOpen((v) => !v)}
          className={`flex h-[34px] w-full items-center gap-2 rounded-sm pl-2.5 text-left text-[14.5px] transition-colors duration-(--motion-fast) hover:bg-surface-secondary ${
            count > 0 ? "pr-[7.5rem]" : "pr-[4.5rem]"
          } ${connected ? "font-semibold text-success" : "text-text-tertiary"}`}
        >
          {connecting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
          <span className="truncate">{channel.channel_name}</span>
          {elapsed && (
            <time title="How long this channel has been in a call" className={`shrink-0 text-[11.5px] font-medium tabular-nums ${connected ? "text-success" : "text-text-muted"}`}>
              {elapsed}
            </time>
          )}
          {count > 0 && <Chevron size={12} className="shrink-0 text-text-muted" aria-hidden="true" />}
        </button>
        {count > 0 && (
          <span
            aria-hidden="true"
            title={`${count} in the call`}
            className="pointer-events-none absolute right-[3.75rem] top-1/2 flex -translate-y-1/2 items-center gap-1 rounded-full bg-surface-secondary px-1.5 py-px text-[11.5px] font-medium tabular-nums text-text-muted"
          >
            <Users size={11} />
            {count}
          </span>
        )}
        {connected ? (
          <span title="You are in this call" className="absolute right-8 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center text-success">
            <SignalHigh size={15} aria-hidden="true" />
            <span className="sr-only">Connected</span>
          </span>
        ) : (
          <button
            type="button"
            disabled={connecting}
            aria-label={`Join voice channel ${channel.channel_name}${inCall}`}
            title="Join"
            onClick={() => voice.requestJoin(id)}
            className="absolute right-8 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-md bg-surface-secondary text-text-body hover:bg-active hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:opacity-50"
          >
            <Phone size={14} aria-hidden="true" />
          </button>
        )}
        {moreButton}
      </div>
      {open && <Roster participants={participants} />}
    </div>
  );
}
