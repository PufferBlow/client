import { useNavigate } from "react-router";
import { Headphones, HeadphoneOff, Mic, MicOff, Settings } from "lucide-react";
import { useMyProfile } from "../../features/users/hooks";
import { useRememberAccount } from "../../features/users/useRememberAccount";
import { useVoice } from "../../features/voice/voiceContext";
import { AccountSwitcher } from "./AccountSwitcher";
import { Avatar } from "./Avatar";

const iconButton =
  "grid h-8 w-8 place-items-center rounded-md text-text-tertiary transition-colors duration-(--motion-fast) hover:bg-active hover:text-text focus-visible:outline-2 focus-visible:outline-focus disabled:text-text-faint disabled:hover:bg-transparent";

export function UserPanel() {
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const voice = useVoice();
  const inCall = voice.status === "connected";
  useRememberAccount();

  return (
    <div className="pointer-events-auto flex items-center gap-2.5 rounded-lg bg-surface-secondary px-3 py-2.5 shadow-modal">
      {me ? (
        <AccountSwitcher>
          <Avatar name={me.username} src={me.avatar_url} seed={me.user_id} size={34} presence={me.status} activity={inCall} muted={inCall && (voice.isMuted || voice.isDeafened)} ringColor="var(--color-surface-secondary)" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-sm font-bold">{me.username}</div>
            <div className="pb-meta truncate text-[11px]">{me.origin_server}</div>
          </div>
        </AccountSwitcher>
      ) : (
        <>
          <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-surface-tertiary" />
          <div className="flex-1" />
        </>
      )}
      <button
        type="button"
        className={`${iconButton} ${voice.isMuted ? "text-error-text" : ""}`}
        aria-label={voice.isMuted ? "Unmute microphone" : "Mute microphone"}
        aria-pressed={voice.isMuted}
        disabled={!inCall}
        title={inCall ? (voice.isMuted ? "Unmute" : "Mute") : "Join a voice channel to use your microphone"}
        onClick={voice.toggleMute}
      >
        {voice.isMuted ? <MicOff size={16} /> : <Mic size={16} />}
      </button>
      <button
        type="button"
        className={`${iconButton} ${voice.isDeafened ? "text-error-text" : ""}`}
        aria-label={voice.isDeafened ? "Undeafen" : "Deafen"}
        aria-pressed={voice.isDeafened}
        disabled={!inCall}
        title={inCall ? (voice.isDeafened ? "Undeafen" : "Deafen") : "Join a voice channel first"}
        onClick={voice.toggleDeafen}
      >
        {voice.isDeafened ? <HeadphoneOff size={16} /> : <Headphones size={16} />}
      </button>
      <button type="button" className={iconButton} aria-label="Settings" onClick={() => navigate("/settings")}>
        <Settings size={16} />
      </button>
    </div>
  );
}
