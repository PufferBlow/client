import type { MouseEvent } from "react";
import { HeadphoneOff, Loader2, MicOff, Volume2 } from "lucide-react";
import { useVoiceParticipants } from "../../features/voice/hooks";
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
        <li key={p.userId} className="flex h-7 items-center gap-2 rounded-md pl-2 pr-1.5 text-[13.5px] text-text-tertiary">
          <span className={`rounded-full ${p.isSpeaking ? "ring-2 ring-success" : ""}`} data-speaking={p.isSpeaking || undefined}>
            <Avatar name={p.username || "?"} seed={p.userId} size={20} />
          </span>
          <span className="min-w-0 flex-1 truncate">{p.username || "Unknown"}</span>
          {p.isMuted && <MicOff size={12} aria-label="Muted" className="shrink-0 text-text-muted" />}
          {p.isDeafened && <HeadphoneOff size={12} aria-label="Deafened" className="shrink-0 text-text-muted" />}
        </li>
      ))}
    </ul>
  );
}

/** A voice channel: click to join, with everyone currently in the call listed underneath. */
export function VoiceChannelRow({ channel, onMenu, moreButton }: VoiceChannelRowProps) {
  const id = channel.channel_id;
  const voice = useVoice();
  const here = voice.channelId === id;
  const connected = here && voice.status === "connected";
  const connecting = here && voice.status === "connecting";

  // The call you are in reports its own roster; every other channel is read from the API.
  const { data: polled = [] } = useVoiceParticipants(id, !(connected || connecting));
  const participants = connected ? voice.participants : polled;

  return (
    <div
      className="group relative"
      onContextMenu={(e: MouseEvent) => {
        e.preventDefault();
        onMenu(id, { x: e.clientX, y: e.clientY });
      }}
    >
      <button
        type="button"
        disabled={connecting}
        aria-pressed={connected}
        aria-label={connected ? `${channel.channel_name}, connected. Click to leave` : `Join voice channel ${channel.channel_name}`}
        onClick={() => void (connected ? voice.leave() : voice.join(id))}
        className={`flex h-8 w-full items-center gap-2 rounded-lg pl-2.5 pr-8 text-left text-[14.5px] transition-colors hover:bg-surface-secondary disabled:cursor-wait ${
          connected ? "font-semibold text-success" : "text-text-tertiary"
        }`}
      >
        {connecting ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Volume2 size={16} aria-hidden="true" />}
        <span className="flex-1 truncate">{channel.channel_name}</span>
      </button>
      {moreButton}
      <Roster participants={participants} />
    </div>
  );
}
