import { AlertCircle, Loader2, PhoneOff, RotateCcw, SignalHigh } from "lucide-react";
import { useChannels } from "../../features/channels/hooks";
import { useVoice } from "../../features/voice/voiceContext";

const action = "grid h-8 w-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-active hover:text-text focus-visible:outline-2 focus-visible:outline-focus";

/** Shown above the user panel while in, joining, or just dropped from a call. */
export function VoiceBar() {
  const voice = useVoice();
  const { data: channels } = useChannels();
  if (voice.status === "idle" || voice.channelId === null) return null;

  const name = channels?.find((c) => c.channel_id === voice.channelId)?.channel_name ?? "voice channel";

  if (voice.status === "failed") {
    return (
      <div role="alert" className="mx-2 mt-2 flex items-center gap-2 rounded-xl bg-error/10 px-2.5 py-2 text-[12.5px]">
        <AlertCircle size={16} className="shrink-0 text-error" aria-hidden="true" />
        <span className="min-w-0 flex-1 leading-tight text-text-secondary">{voice.error ?? "The call ended."}</span>
        <button type="button" className={action} aria-label={`Rejoin ${name}`} title="Rejoin" onClick={() => void voice.join(voice.channelId!)}>
          <RotateCcw size={15} />
        </button>
        <button type="button" className={action} aria-label="Dismiss" title="Dismiss" onClick={() => void voice.leave()}>
          <PhoneOff size={15} />
        </button>
      </div>
    );
  }

  const connecting = voice.status === "connecting";
  return (
    <div role="status" className="mx-2 mt-2 flex items-center gap-2 rounded-xl bg-surface-secondary px-2.5 py-2">
      {connecting ? (
        <Loader2 size={16} className="shrink-0 animate-spin text-text-tertiary" aria-hidden="true" />
      ) : (
        <SignalHigh size={16} className="shrink-0 text-success" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <div className={`text-[12.5px] font-semibold ${connecting ? "text-text-tertiary" : "text-success"}`}>{connecting ? "Connecting…" : "Voice connected"}</div>
        <div className="truncate text-[11.5px] text-text-tertiary">{name}</div>
      </div>
      <button type="button" className={action} aria-label="Leave voice channel" title="Leave" onClick={() => void voice.leave()}>
        <PhoneOff size={15} />
      </button>
    </div>
  );
}
