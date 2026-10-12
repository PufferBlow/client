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
    setState(IDLE_VOICE);
  }, [release]);

  const join = useCallback(
    async (channelId: string) => {
      const profile = meRef.current;
      if (!profile) {
        setState({ ...IDLE_VOICE, status: "failed", channelId, error: "Your profile hasn't loaded yet. Try again in a moment." });
        return;
      }

      attempt.current += 1;
      const mine = attempt.current;
      await release();
      setState({ ...IDLE_VOICE, status: "connecting", channelId });

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
        transport.current = next;
        await next.connect();
      } catch (error) {
        if (attempt.current !== mine) return;
        // Connect failures already reported through onStatus; a failure before the transport existed did not.
        setState((s) =>
          s.status === "failed" ? s : { ...IDLE_VOICE, status: "failed", channelId, error: error instanceof Error ? error.message : "Couldn't join the voice channel." },
        );
        if (id && sessionId.current === null) await leaveVoiceSession(id).catch(() => undefined);
      }
    },
    [release, deps],
  );

  const toggleMute = useCallback(() => {
    const current = transport.current;
    if (!current) return;
    const muted = !current.isMuted;
    // Un-muting while deafened would be talking to a room you cannot hear.
    if (!muted && current.isDeafened) {
      current.setDeafened(false);
      setState((s) => ({ ...s, isDeafened: false }));
    }
    current.setMuted(muted);
    setState((s) => ({ ...s, isMuted: muted }));
    if (sessionId.current) void applyVoiceAction(sessionId.current, "mute_self", muted).catch(() => undefined);
  }, []);

  const toggleDeafen = useCallback(() => {
    const current = transport.current;
    if (!current) return;
    const deafened = !current.isDeafened;
    if (deafened) {
      mutedBeforeDeafen.current = current.isMuted;
      current.setMuted(true);
    } else {
      current.setMuted(mutedBeforeDeafen.current);
    }
    current.setDeafened(deafened);
    setState((s) => ({ ...s, isDeafened: deafened, isMuted: current.isMuted }));
    const id = sessionId.current;
    if (id) {
      void applyVoiceAction(id, "deafen_self", deafened).catch(() => undefined);
      void applyVoiceAction(id, "mute_self", current.isMuted).catch(() => undefined);
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
