import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useMyProfile } from "../users/hooks";
import { applyVoiceAction, joinVoiceSession, leaveVoiceSession } from "./api";
import { browserDeps, VoiceTransport, type VoiceDeps } from "./transport";
import { IDLE_VOICE, VoiceContext, type VoiceControls, type VoiceState } from "./voiceContext";

/**
 * Owns the one call this client can be in. Joining a channel while in another leaves the first.
 * The call ends when the dashboard unmounts (sign out, closing the window).
 */
export function VoiceProvider({ children, deps = browserDeps }: { children: ReactNode; deps?: VoiceDeps }) {
  const { data: me } = useMyProfile();
  const [state, setState] = useState<VoiceState>(IDLE_VOICE);

  const transport = useRef<VoiceTransport | null>(null);
  const sessionId = useRef<string | null>(null);
  /** Bumped on every join/leave so a slow handshake from an abandoned attempt cannot touch the new state. */
  const attempt = useRef(0);
  const mutedBeforeDeafen = useRef(false);
  /**
   * Whether the microphone and speakers are off. It is the person's setting, so it holds outside a
   * call too: switch the microphone off first and the next call starts muted.
   */
  const audio = useRef({ muted: false, deafened: false });
  const idle = useCallback((): VoiceState => ({ ...IDLE_VOICE, isMuted: audio.current.muted, isDeafened: audio.current.deafened }), []);
  const meRef = useRef(me);
  meRef.current = me;

  const release = useCallback(async () => {
    const current = transport.current;
    const id = sessionId.current;
    transport.current = null;
    sessionId.current = null;
    current?.disconnect();
    if (id) await leaveVoiceSession(id).catch(() => undefined); // the server also notices the socket closing
  }, []);

  const leave = useCallback(async () => {
    attempt.current += 1;
    await release();
    setState(idle());
  }, [release, idle]);

  const join = useCallback(
    async (channelId: string) => {
      const profile = meRef.current;
      if (!profile) {
        setState({ ...idle(), status: "failed", channelId, error: "Your profile hasn't loaded yet. Try again in a moment." });
        return;
      }

      attempt.current += 1;
      const mine = attempt.current;
      await release();
      setState({ ...idle(), status: "connecting", channelId });

      let id: string | null = null;
      try {
        const grant = await joinVoiceSession(channelId);
        id = grant.sessionId;
        if (attempt.current !== mine) {
          await leaveVoiceSession(id).catch(() => undefined);
          return;
        }
        sessionId.current = id;

        const next = new VoiceTransport(
          grant,
          { userId: profile.user_id, username: profile.username },
          {
            onStatus: (status, error) => {
              if (attempt.current !== mine) return;
              setState((s) => ({ ...s, status, error: error ?? null }));
              if (status === "failed") {
                // The call is over; free the seat on the server and let the user rejoin from the bar.
                const dead = transport.current;
                transport.current = null;
                dead?.disconnect();
                const failedId = sessionId.current;
                sessionId.current = null;
                if (failedId) void leaveVoiceSession(failedId).catch(() => undefined);
              }
            },
            onParticipants: (participants) => {
              if (attempt.current === mine) setState((s) => ({ ...s, participants }));
            },
          },
          deps,
        );
        // Start the way the person's settings say: muted or deafened stays so across the join.
        next.setMuted(audio.current.muted);
        next.setDeafened(audio.current.deafened);
        transport.current = next;
        await next.connect();
      } catch (error) {
        if (attempt.current !== mine) return;
        // Connect failures already reported through onStatus; a failure before the transport existed did not.
        setState((s) =>
          s.status === "failed" ? s : { ...idle(), status: "failed", channelId, error: error instanceof Error ? error.message : "Couldn't join the voice channel." },
        );
        if (id && sessionId.current === null) await leaveVoiceSession(id).catch(() => undefined);
      }
    },
    [release, deps, idle],
  );

  const toggleMute = useCallback(() => {
    const muted = !audio.current.muted;
    // Un-muting while deafened would be talking to a room you cannot hear.
    const deafened = !muted && audio.current.deafened ? false : audio.current.deafened;
    audio.current = { muted, deafened };
    setState((s) => ({ ...s, isMuted: muted, isDeafened: deafened }));
    const current = transport.current;
    if (!current) return;
    if (current.isDeafened !== deafened) current.setDeafened(deafened);
    current.setMuted(muted);
    if (sessionId.current) void applyVoiceAction(sessionId.current, "mute_self", muted).catch(() => undefined);
  }, []);

  const toggleDeafen = useCallback(() => {
    const deafened = !audio.current.deafened;
    let muted = audio.current.muted;
    if (deafened) {
      mutedBeforeDeafen.current = muted;
      muted = true;
    } else {
      muted = mutedBeforeDeafen.current;
    }
    audio.current = { muted, deafened };
    setState((s) => ({ ...s, isDeafened: deafened, isMuted: muted }));
    const current = transport.current;
    if (!current) return;
    current.setMuted(muted);
    current.setDeafened(deafened);
    const id = sessionId.current;
    if (id) {
      void applyVoiceAction(id, "deafen_self", deafened).catch(() => undefined);
      void applyVoiceAction(id, "mute_self", muted).catch(() => undefined);
    }
  }, []);

  // Leave when the dashboard goes away.
  useEffect(
    () => () => {
      attempt.current += 1;
      void release();
    },
    [release],
  );

  const value = useMemo<VoiceControls>(() => ({ ...state, join, leave, toggleMute, toggleDeafen }), [state, join, leave, toggleMute, toggleDeafen]);
  return <VoiceContext.Provider value={value}>{children}</VoiceContext.Provider>;
}
