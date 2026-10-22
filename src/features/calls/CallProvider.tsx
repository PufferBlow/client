import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { getStoredInstance } from "../../services/instance";
import { useUsers, useMyProfile } from "../users/hooks";
import { useVoice } from "../voice/voiceContext";
import { leaveVoiceSession } from "../voice/api";
import { browserDeps as browserVoiceDeps } from "../voice/transport";
import { acceptCall, endCall, inviteToCall, joinCallRelay, registerIdentityKey, rejectCall, sendCallSignal } from "./api";
import { CallContext, isCallActive, type CallControls } from "./callContext";
import { loadIdentity, indexedDbKeyStore, memoryKeyStore, type Identity, type KeyStore } from "./crypto/identity";
import { localPinStore, markVerified as pinVerified, type PinStore } from "./crypto/trust";
import { browserCallDeps, CallEngine, type CallDeps, type RelaySetup } from "./engine";
import { browserFrameEncryption, canEncryptFrames } from "./frameEncryption";
import { notifyIncomingCall, startRinging } from "./ring";
import { callSignals } from "./signals";
import { IDLE_CALL, type CallState, type IceServer } from "./types";

/** A call nobody picks up is given up on after this long. */
const RING_MS = 45_000;

const hasIndexedDb = () => {
  try {
    return typeof indexedDB !== "undefined";
  } catch {
    return false;
  }
};

interface CallProviderProps {
  children: ReactNode;
  deps?: CallDeps;
  keyStore?: KeyStore;
  pinStore?: (accountId: string) => PinStore;
  /** How a call that cannot connect directly goes through the media server. Defaults to the browser's. */
  relay?: (callId: string) => RelaySetup;
}

/** Developer switch: `localStorage.pb_calls_force_relay = "1"` skips the direct attempt, to try the relay. */
const forceRelay = () => {
  try {
    return localStorage.getItem("pb_calls_force_relay") === "1";
  } catch {
    return false;
  }
};

const browserRelay = (callId: string): RelaySetup => ({
  grant: () => joinCallRelay(callId),
  leave: leaveVoiceSession,
  voiceDeps: { createSocket: browserVoiceDeps.createSocket, createPeer: browserVoiceDeps.createPeer, createAudio: browserVoiceDeps.createAudio, watchSpeaking: browserVoiceDeps.watchSpeaking },
  encryption: () => (canEncryptFrames() ? browserFrameEncryption() : null),
  forceRelay: forceRelay(),
});

/**
 * Owns the one call this client can be on. It rings, answers and ends calls through the instance,
 * and hands the audio to a `CallEngine`, which signs and verifies the negotiation. Starting or
 * answering a call leaves any voice channel first: there is one audio session at a time.
 */
export function CallProvider({ children, deps = browserCallDeps, keyStore, pinStore = localPinStore, relay = browserRelay }: CallProviderProps) {
  const { data: me } = useMyProfile();
  const { data: users } = useUsers();
  const voice = useVoice();
  const [state, setState] = useState<CallState>(IDLE_CALL);

  const engine = useRef<CallEngine | null>(null);
  const call = useRef<{ id: string; peerId: string; role: "caller" | "callee"; iceServers: IceServer[] } | null>(null);
  const ringTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stateRef = useRef(state);
  stateRef.current = state;
  const usersRef = useRef(users);
  usersRef.current = users;
  const leaveVoice = useRef(voice.leave);
  leaveVoice.current = voice.leave;

  const accountId = me ? `${getStoredInstance()?.origin ?? "instance"}|${me.user_id}` : null;
  const identity = useRef<Identity | null>(null);
  const identityReady = useRef<Promise<Identity> | null>(null);
  const pins = useRef<PinStore | null>(null);

  // The key pair is made (or found) on first need. Registering it is for other devices and best effort.
  const ensureIdentity = useCallback((): Promise<Identity> => {
    if (!accountId) return Promise.reject(new Error("Your profile hasn't loaded yet."));
    if (!identityReady.current) {
      const store = keyStore ?? (hasIndexedDb() ? indexedDbKeyStore : memoryKeyStore());
      identityReady.current = loadIdentity(store, accountId).then((loaded) => {
        identity.current = loaded;
        void registerIdentityKey(loaded.publicKey, navigator.platform || "This device").catch(() => undefined);
        return loaded;
      });
      identityReady.current.catch(() => (identityReady.current = null));
    }
    return identityReady.current;
  }, [accountId, keyStore]);

  const patch = useCallback((next: Partial<CallState>) => setState((s) => ({ ...s, ...next })), []);

  const clearRing = () => {
    if (ringTimer.current) clearTimeout(ringTimer.current);
    ringTimer.current = null;
  };

  /** Drop the call: stop the audio and show how it ended. */
  const finish = useCallback((message: string | null, phase: "ended" | "failed" = "ended") => {
    clearRing();
    engine.current?.close();
    engine.current = null;
    call.current = null;
    setState((s) => ({ ...s, phase, error: message, callId: s.callId }));
  }, []);

  const nameOf = (userId: string) => usersRef.current?.find((u) => u.user_id === userId)?.username ?? "Someone";

  const buildEngine = useCallback(
    async (role: "caller" | "callee", callId: string, peerId: string, iceServers: IceServer[]) => {
      const self = await ensureIdentity();
      pins.current ??= pinStore(accountId ?? "");
      const next = new CallEngine({
        callId,
        role,
        self: { userId: me!.user_id, username: me!.username },
        peer: { userId: peerId },
        iceServers,
        identity: self,
        pins: pins.current,
        send: (type, payload) => sendCallSignal(callId, type, payload),
        onState: (partial) => {
          if (call.current?.id !== callId) return;
          if (partial.phase === "failed") {
            // The engine has already closed itself; tell the other side and free the call.
            void endCall(callId).catch(() => undefined);
            finish(partial.error ?? "The call failed.", "failed");
            return;
          }
          patch(partial);
        },
        deps,
        relay: relay(callId),
      });
      engine.current = next;
      return next;
    },
    [accountId, deps, ensureIdentity, finish, me, patch, pinStore, relay],
  );

  // ── placing and answering ─────────────────────────────────

  const startCall = useCallback<CallControls["startCall"]>(
    async (peer) => {
      if (isCallActive(stateRef.current) || !me) return;
      await leaveVoice.current();
      setState({ ...IDLE_CALL, phase: "calling", direction: "outgoing", peerId: peer.userId, peerName: peer.name });
      try {
        const started = await inviteToCall(peer.userId);
        call.current = { id: started.callId, peerId: peer.userId, role: "caller", iceServers: started.iceServers };
        patch({ callId: started.callId });
        const next = await buildEngine("caller", started.callId, peer.userId, started.iceServers);
        void next.start().catch((error: unknown) => {
          void endCall(started.callId).catch(() => undefined);
          finish(error instanceof Error ? error.message : "Couldn't start the call.", "failed");
        });
        ringTimer.current = setTimeout(() => {
          void endCall(started.callId).catch(() => undefined);
          finish(`${peer.name} didn't answer.`);
        }, RING_MS);
      } catch (error) {
        finish(error instanceof Error ? error.message : "Couldn't start the call.", "failed");
      }
    },
    [buildEngine, finish, me, patch],
  );

  const accept = useCallback(async () => {
    const current = call.current;
    if (!current || stateRef.current.phase !== "incoming") return;
    await leaveVoice.current();
    clearRing();
    patch({ phase: "connecting" });
    try {
      const iceServers = await acceptCall(current.id);
      current.iceServers = iceServers;
      const next = await buildEngine("callee", current.id, current.peerId, iceServers);
      await next.start();
    } catch (error) {
      void rejectCall(current.id).catch(() => undefined);
      finish(error instanceof Error ? error.message : "Couldn't answer the call.", "failed");
    }
  }, [buildEngine, finish, patch]);

  const decline = useCallback(async () => {
    const current = call.current;
    if (!current) return;
    void rejectCall(current.id).catch(() => undefined);
    finish(null);
  }, [finish]);

  const hangUp = useCallback(async () => {
    const current = call.current;
    if (!current) return;
    const ringing = stateRef.current.phase === "incoming";
    void (ringing ? rejectCall(current.id) : endCall(current.id)).catch(() => undefined);
    finish(null);
  }, [finish]);

  // An incoming call is heard (and, from a background window, seen) until it is answered or given up on.
  const ringingFor = state.phase === "incoming" ? state.callId : null;
  const callerName = state.peerName;
  useEffect(() => {
    if (!ringingFor) return;
    const stopRing = startRinging();
    const closeNotice = notifyIncomingCall(callerName || "Someone");
    return () => {
      stopRing();
      closeNotice();
    };
  }, [ringingFor, callerName]);

  // ── what the other side does ──────────────────────────────

  useEffect(
    () =>
      callSignals.subscribe((signal) => {
        const current = call.current;

        if (signal.kind === "invite") {
          if (isCallActive(stateRef.current)) {
            void rejectCall(signal.callId).catch(() => undefined); // busy: they hear it as a decline
            return;
          }
          call.current = { id: signal.callId, peerId: signal.callerId, role: "callee", iceServers: [] };
          setState({ ...IDLE_CALL, phase: "incoming", direction: "incoming", callId: signal.callId, peerId: signal.callerId, peerName: nameOf(signal.callerId) });
          return;
        }

        if (!current || signal.callId !== current.id) return;
        switch (signal.kind) {
          case "accepted":
            clearRing();
            patch({ phase: "connecting" });
            void engine.current?.beginOffer().catch((error: unknown) => {
              void endCall(current.id).catch(() => undefined);
              finish(error instanceof Error ? error.message : "Couldn't set up the call.", "failed");
            });
            return;
          case "rejected":
            finish(`${stateRef.current.peerName || "They"} declined.`);
            return;
          case "ended":
            finish(stateRef.current.phase === "incoming" ? "Missed call." : "The call ended.");
            return;
          default:
            if (signal.fromUserId === current.peerId) engine.current?.handleSignal(signal.kind, signal.payload);
        }
      }),
    [finish, patch],
  );

  useEffect(
    () => () => {
      clearRing();
      const current = call.current;
      engine.current?.close();
      if (current) void endCall(current.id).catch(() => undefined);
    },
    [],
  );

  const value = useMemo<CallControls>(
    () => ({
      ...state,
      startCall,
      accept,
      decline,
      hangUp,
      toggleMute: () => {
        const e = engine.current;
        if (e) e.setMuted(!e.isMuted);
      },
      resolveKeyChange: (acceptIt) => engine.current?.resolveKeyChange(acceptIt),
      markVerified: () => {
        const encryption = stateRef.current.encryption;
        const peerId = stateRef.current.peerId;
        if (encryption.status !== "protected" || !peerId || !pins.current) return;
        pinVerified(pins.current, peerId, encryption.keyId);
        patch({ encryption: { ...encryption, trust: "verified" } });
      },
      dismiss: () => setState(IDLE_CALL),
    }),
    [state, startCall, accept, decline, hangUp, patch],
  );

  return <CallContext.Provider value={value}>{children}</CallContext.Provider>;
}
