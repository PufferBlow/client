import { AlertCircle, Loader2, PhoneOff, RotateCcw, SignalHigh } from "lucide-react";
import { useNavigate } from "react-router";
import { useChannels } from "../../features/channels/hooks";
import { useServerInfo } from "../../features/server/hooks";
import { useVoice } from "../../features/voice/voiceContext";

const action = "grid h-8 w-8 shrink-0 place-items-center rounded-md text-text-tertiary transition-colors hover:bg-active hover:text-text focus-visible:outline-2 focus-visible:outline-focus";

/**
 * The call you are in, as the top of the user card: what it is and where (`channel / server`, so it is clear from
 * any page), and how to hang up. Shown while joining, in a call, or just dropped.
 */
export function VoiceCard() {
  const voice = useVoice();
  const navigate = useNavigate();
  const { data: channels } = useChannels();
  const { data: server } = useServerInfo();
  if (voice.status === "idle" || voice.channelId === null) return null;

  const name = channels?.find((c) => c.channel_id === voice.channelId)?.channel_name ?? "voice channel";
  const where = server?.server_name ?? "this server";

  if (voice.status === "failed") {
    return (
      <div role="alert" className="flex items-center gap-2.5 rounded-t-lg border-b border-border-secondary bg-error/10 px-3 py-2.5 text-[12.5px]">
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
    <div role="status" className="flex items-center gap-2.5 border-b border-border-secondary px-3 py-2.5">
      {connecting ? (
        <Loader2 size={18} className="shrink-0 animate-spin text-text-tertiary" aria-hidden="true" />
      ) : (
        <SignalHigh size={18} className="shrink-0 text-success" aria-hidden="true" />
      )}
      <div className="min-w-0 flex-1 leading-tight">
        <div className={`text-[13px] font-bold ${connecting ? "text-text-tertiary" : "text-success"}`}>{connecting ? "Connecting…" : "Voice connected"}</div>
        <button
          type="button"
          title={`Go to ${name}`}
          onClick={() => navigate("/dashboard/channels")}
          className="block max-w-full truncate border-0 bg-transparent p-0 text-left text-[12px] text-text-tertiary hover:text-text hover:underline"
        >
          {name} / {where}
        </button>
      </div>
      <button type="button" className={action} aria-label="Leave voice channel" title="Disconnect" onClick={() => void voice.leave()}>
        <PhoneOff size={16} />
      </button>
    </div>
  );
}
