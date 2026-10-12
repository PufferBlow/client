import { useNavigate } from "react-router";
import { Headphones, HeadphoneOff, LogOut, Mic, MicOff, Settings } from "lucide-react";
import { useMyProfile } from "../../features/users/hooks";
import { useVoice } from "../../features/voice/voiceContext";
import { logout } from "../../services/auth";
import { Avatar } from "./Avatar";

const iconButton =
  "grid h-8 w-8 place-items-center rounded-lg text-text-tertiary transition-colors hover:bg-active hover:text-text focus-visible:outline-2 focus-visible:outline-focus";

export function UserPanel() {
  const navigate = useNavigate();
  const { data: me } = useMyProfile();
  const voice = useVoice();
  const inCall = voice.status === "connected";

  const handleSignOut = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="m-2 flex items-center gap-2.5 rounded-xl bg-surface-secondary px-2.5 py-2">
      {me ? (
        <>
          <Avatar name={me.username} src={me.avatar_url} seed={me.user_id} size={34} presence={me.status} ringColor="var(--color-surface-secondary)" />
          <div className="min-w-0 flex-1 leading-tight">
            <div className="truncate text-[13px] font-semibold">{me.username}</div>
            <div className="truncate text-[11px] text-text-tertiary">@{me.origin_server}</div>
          </div>
        </>
      ) : (
        <>
          <div className="h-[34px] w-[34px] animate-pulse rounded-full bg-surface-tertiary" />
          <div className="flex-1" />
        </>
      )}
      <button
        type="button"
        className={`${iconButton} ${voice.isMuted ? "text-error" : ""}`}
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
        className={`${iconButton} ${voice.isDeafened ? "text-error" : ""}`}
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
      <button type="button" className={iconButton} aria-label="Sign out" title="Sign out" onClick={handleSignOut}>
        <LogOut size={16} />
      </button>
    </div>
  );
}
