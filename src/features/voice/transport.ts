import { parseSignal, signal, type SignalFrame } from "./signaling";
import { newParticipant, type IceServer, type VoiceParticipant, type VoiceSessionGrant, type VoiceStatus } from "./types";

/** Everything the browser provides, so the transport can be driven by fakes in tests. */
export interface VoiceDeps {
  createSocket(url: string): WebSocket;
  createPeer(config: RTCConfiguration): RTCPeerConnection;
  getMicrophone(): Promise<MediaStream>;
  /** An element remote audio plays through. */
  createAudio(): HTMLAudioElement;
  /** Calls back with true/false as the stream goes above or below speaking level. Returns a stop function. */
  watchSpeaking(stream: MediaStream, onChange: (speaking: boolean) => void): () => void;
}

export interface VoiceEvents {
  onStatus(status: VoiceStatus, error?: string): void;
  onParticipants(participants: VoiceParticipant[]): void;
}

export class VoiceError extends Error {
  constructor(
    readonly kind: "microphone" | "connection" | "server",
    message: string,
  ) {
    super(message);
    this.name = "VoiceError";
  }
}

const PING_INTERVAL_MS = 20_000;
/** The media server needs a moment to confirm the join; give up if it never does. */
const JOIN_TIMEOUT_MS = 15_000;
const SPEAKING_REPORT_MS = 150;

function signalingUrl(base: string, token: string): string {
  return `${base}${base.includes("?") ? "&" : "?"}join_token=${encodeURIComponent(token)}`;
}

/**
 * One call. Opens the media server's signalling socket with the one-time join token, negotiates a
 * WebRTC connection (we offer our microphone, the server offers everyone else's audio), keeps the
 * participant list in step with the server, and carries mute and deafen state both ways.
 *
 * It does not reconnect: the join token is single use, so rejoining means asking the API for a new
 * session grant. The owner decides when to do that.
 */
export class VoiceTransport {
  private socket: WebSocket | null = null;
  private peer: RTCPeerConnection | null = null;
  private microphone: MediaStream | null = null;
  private pingTimer: ReturnType<typeof setInterval> | null = null;
  private joinTimer: ReturnType<typeof setTimeout> | null = null;
  private stopSpeakingWatch: (() => void) | null = null;
  private speakingTimer: ReturnType<typeof setTimeout> | null = null;
  private readonly speakers = new Map<string, HTMLAudioElement>();
  private pendingCandidates: RTCIceCandidateInit[] = [];
  /** Frames are applied one after another: two offers in a row must not interleave their steps. */
  private queue: Promise<void> = Promise.resolve();
  /** Candidates we gathered before our offer went out; the server needs the offer first. */
  private outgoingCandidates: RTCIceCandidateInit[] | null = [];
  private participants = new Map<string, VoiceParticipant>();
  private muted = false;
  private deafened = false;
  private speaking = false;
  private closed = false;
  private failedAlready = false;
  private abortOpen: (() => void) | null = null;

  constructor(
    private readonly grant: VoiceSessionGrant,
    private readonly self: { userId: string; username: string },
    private readonly events: VoiceEvents,
    private readonly deps: VoiceDeps,
  ) {}

  get isMuted(): boolean {
    return this.muted;
  }
  get isDeafened(): boolean {
    return this.deafened;
  }

  async connect(): Promise<void> {
    this.events.onStatus("connecting");

    try {
      this.microphone = await this.deps.getMicrophone();
    } catch (error) {
      throw this.fail(new VoiceError("microphone", microphoneMessage(error)));
    }
    if (this.closed) {
      this.stopMicrophone();
      return;
    }

    const peer = this.deps.createPeer({ iceServers: toRtcServers(this.grant.iceServers) });
    this.peer = peer;
    for (const track of this.microphone.getAudioTracks()) peer.addTrack(track, this.microphone);

    peer.onicecandidate = (event) => {
      if (!event.candidate) return;
      if (this.outgoingCandidates) this.outgoingCandidates.push(event.candidate.toJSON());
      else this.send(signal.candidate(event.candidate.toJSON()));
    };
    peer.ontrack = (event) => this.playRemote(event);
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "failed") this.fail(new VoiceError("connection", "The audio connection failed."));
    };

    this.stopSpeakingWatch = this.deps.watchSpeaking(this.microphone, (speaking) => this.reportSpeaking(speaking));

    const socket = this.deps.createSocket(signalingUrl(this.grant.signalingUrl, this.grant.joinToken));
    this.socket = socket;
    socket.onmessage = (message: MessageEvent) => {
      const frame = parseSignal(message.data);
      this.queue = this.queue.then(() => this.handleFrame(frame));
    };
    socket.onerror = () => undefined; // `onclose` follows and reports it

    let opened = false;
    const open = new Promise<void>((resolve, reject) => {
      this.abortOpen = () => reject(new VoiceError("connection", "Cancelled."));
      socket.onopen = () => {
        opened = true;
        resolve();
      };
      socket.onclose = () => {
        if (!opened) reject(new VoiceError("connection", "Couldn't reach the voice server."));
        else if (!this.closed) this.fail(new VoiceError("connection", "The connection to the voice server was lost."));
      };
    });
    try {
      await open;
    } catch (error) {
      if (this.closed) return; // the caller left while we were connecting
      throw this.fail(error instanceof VoiceError ? error : new VoiceError("connection", "Couldn't reach the voice server."));
    } finally {
      this.abortOpen = null;
    }

    this.joinTimer = setTimeout(() => this.fail(new VoiceError("server", "The voice server did not confirm the join.")), JOIN_TIMEOUT_MS);
    this.send(JSON.stringify({ type: "join", session_id: this.grant.sessionId }));
    await this.offer();
  }

  /** Leave: tell the server, then release the socket, the connection and the microphone. */
  disconnect(): void {
    if (this.closed) return;
    this.closed = true;
    this.send(signal.leave());
    this.abortOpen?.();
    this.teardown();
    this.events.onStatus("idle");
  }

  setMuted(muted: boolean): void {
    this.muted = muted;
    for (const track of this.microphone?.getAudioTracks() ?? []) track.enabled = !muted;
    if (muted && this.speaking) this.reportSpeaking(false);
    this.patchSelf({ isMuted: muted, ...(muted ? { isSpeaking: false } : {}) });
    this.send(signal.audioState({ isMuted: muted, ...(muted ? { isSpeaking: false } : {}) }));
  }

  setDeafened(deafened: boolean): void {
    this.deafened = deafened;
    for (const audio of this.speakers.values()) audio.muted = deafened;
    this.patchSelf({ isDeafened: deafened });
    this.send(signal.audioState({ isDeafened: deafened }));
  }

  // ── negotiation ──────────────────────────────────────────────

  private async offer(): Promise<void> {
    const peer = this.peer;
    if (!peer) return;
    const offer = await peer.createOffer();
    await peer.setLocalDescription(offer);
    this.send(signal.offer(offer));
    this.flushOutgoingCandidates();
  }

  private flushOutgoingCandidates(): void {
    const queued = this.outgoingCandidates ?? [];
    this.outgoingCandidates = null;
    for (const candidate of queued) this.send(signal.candidate(candidate));
  }

  private async handleFrame(frame: SignalFrame | null): Promise<void> {
    if (!frame || this.closed) return;
    try {
      await this.apply(frame);
    } catch (error) {
      this.fail(new VoiceError("connection", error instanceof Error ? error.message : "Voice negotiation failed."));
    }
  }

  private async apply(frame: SignalFrame): Promise<void> {
    const peer = this.peer;

    switch (frame.type) {
      case "joined":
        if (this.joinTimer) clearTimeout(this.joinTimer);
        this.joinTimer = null;
        this.participants = new Map(frame.participants.map((p) => [p.userId, p]));
        if (!this.participants.has(this.self.userId)) {
          this.participants.set(this.self.userId, { ...newParticipant(this.self.userId, this.self.username), isMuted: this.muted, isDeafened: this.deafened });
        }
        this.emitParticipants();
        this.startPing();
        this.events.onStatus("connected");
        if (this.muted || this.deafened) this.send(signal.audioState({ isMuted: this.muted, isDeafened: this.deafened }));
        return;

      case "participant_joined":
        if (!this.participants.has(frame.userId)) {
          this.participants.set(frame.userId, newParticipant(frame.userId, frame.username));
          this.emitParticipants();
        }
        return;

      case "participant_left":
        this.speakers.delete(frame.userId);
        if (this.participants.delete(frame.userId)) this.emitParticipants();
        return;

      case "speaker_levels": {
        const current = this.participants.get(frame.userId);
        if (!current) return;
        this.participants.set(frame.userId, { ...current, isSpeaking: frame.isSpeaking, isMuted: frame.isMuted, isDeafened: frame.isDeafened });
        this.emitParticipants();
        return;
      }

      case "offer": {
        if (!peer) return;
        // The server's offer wins over one of ours that has not been answered yet. The server drops ours
        // in that case, so once its offer is answered ours is sent again.
        const preempted = peer.signalingState === "have-local-offer";
        if (preempted) await peer.setLocalDescription({ type: "rollback" });
        await peer.setRemoteDescription(frame.sdp);
        await this.flushCandidates();
        const answer = await peer.createAnswer();
        await peer.setLocalDescription(answer);
        this.send(signal.answer(answer));
        this.flushOutgoingCandidates();
        if (preempted) await this.offer();
        return;
      }

      case "answer":
        if (!peer) return;
        await peer.setRemoteDescription(frame.sdp);
        await this.flushCandidates();
        return;

      case "candidate":
        // Candidates can arrive before the remote description they belong to.
        if (peer?.remoteDescription) await peer.addIceCandidate(frame.candidate);
        else this.pendingCandidates.push(frame.candidate);
        return;

      case "error":
        this.fail(new VoiceError("server", frame.message));
        return;

      case "leave_ack":
      case "pong":
        return;
    }
  }

  private async flushCandidates(): Promise<void> {
    const queued = this.pendingCandidates;
    this.pendingCandidates = [];
    for (const candidate of queued) await this.peer?.addIceCandidate(candidate);
  }

  // ── media ────────────────────────────────────────────────────

  private playRemote(event: RTCTrackEvent): void {
    if (event.track.kind !== "audio") return;
    const stream = event.streams[0] ?? new MediaStream([event.track]);
    if (this.speakers.has(stream.id)) return;

    const audio = this.deps.createAudio();
    audio.srcObject = stream;
    audio.autoplay = true;
    audio.muted = this.deafened;
    void audio.play?.().catch(() => undefined); // autoplay can be blocked until the next click; the track stays attached
    this.speakers.set(stream.id, audio);
  }

  private reportSpeaking(speaking: boolean): void {
    if (this.muted && speaking) return;
    if (this.speaking === speaking) return;
    this.speaking = speaking;
    // Debounce: the level meter flickers, the roster should not.
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.speakingTimer = setTimeout(() => {
      this.patchSelf({ isSpeaking: speaking });
      this.send(signal.audioState({ isSpeaking: speaking }));
    }, SPEAKING_REPORT_MS);
  }

  // ── plumbing ─────────────────────────────────────────────────

  private patchSelf(patch: Partial<VoiceParticipant>): void {
    const me = this.participants.get(this.self.userId);
    if (!me) return;
    this.participants.set(this.self.userId, { ...me, ...patch });
    this.emitParticipants();
  }

  private emitParticipants(): void {
    this.events.onParticipants([...this.participants.values()]);
  }

  private send(text: string): boolean {
    const socket = this.socket;
    if (!socket || socket.readyState !== WebSocket.OPEN) return false;
    socket.send(text);
    return true;
  }

  private startPing(): void {
    if (this.pingTimer) return;
    this.pingTimer = setInterval(() => this.send(signal.ping()), PING_INTERVAL_MS);
  }

  private fail(error: VoiceError): VoiceError {
    if (!this.failedAlready && !this.closed) {
      this.failedAlready = true;
      this.closed = true;
      this.teardown();
      this.events.onStatus("failed", error.message);
    }
    return error;
  }

  private stopMicrophone(): void {
    for (const track of this.microphone?.getTracks() ?? []) track.stop();
    this.microphone = null;
  }

  private teardown(): void {
    if (this.pingTimer) clearInterval(this.pingTimer);
    if (this.joinTimer) clearTimeout(this.joinTimer);
    if (this.speakingTimer) clearTimeout(this.speakingTimer);
    this.pingTimer = this.joinTimer = this.speakingTimer = null;
    this.stopSpeakingWatch?.();
    this.stopSpeakingWatch = null;

    const socket = this.socket;
    this.socket = null;
    if (socket) {
      socket.onclose = null;
      socket.onmessage = null;
      socket.close(1000, "leaving");
    }

    if (this.peer) {
      this.peer.onicecandidate = null;
      this.peer.ontrack = null;
      this.peer.onconnectionstatechange = null;
      this.peer.close();
      this.peer = null;
    }
    for (const audio of this.speakers.values()) {
      audio.pause?.();
      audio.srcObject = null;
    }
    this.speakers.clear();
    this.stopMicrophone();
    this.participants.clear();
  }
}

function toRtcServers(servers: IceServer[]): RTCIceServer[] {
  return servers.map(({ urls, username, credential }) => ({ urls, ...(username && { username }), ...(credential && { credential }) }));
}

function microphoneMessage(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "Microphone access was blocked. Allow it in your browser or system settings and try again.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No microphone was found.";
  return "Couldn't start your microphone.";
}

/** The real browser APIs. */
export const browserDeps: VoiceDeps = {
  createSocket: (url) => new WebSocket(url),
  createPeer: (config) => new RTCPeerConnection(config),
  getMicrophone: () => navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false }),
  createAudio: () => {
    const audio = new Audio();
    audio.autoplay = true;
    return audio;
  },
  watchSpeaking: (stream, onChange) => {
    const AudioContextCtor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextCtor) return () => undefined;

    const context = new AudioContextCtor();
    const analyser = context.createAnalyser();
    analyser.fftSize = 512;
    context.createMediaStreamSource(stream).connect(analyser);
    const samples = new Uint8Array(analyser.fftSize);

    let speaking = false;
    let quietSince = 0;
    const timer = setInterval(() => {
      analyser.getByteTimeDomainData(samples);
      let peak = 0;
      for (const sample of samples) peak = Math.max(peak, Math.abs(sample - 128));
      const loud = peak > 10;
      if (loud) quietSince = 0;
      else if (quietSince === 0) quietSince = Date.now();
      const next = loud || (speaking && Date.now() - quietSince < 400);
      if (next !== speaking) {
        speaking = next;
        onChange(speaking);
      }
    }, 80);

    return () => {
      clearInterval(timer);
      void context.close();
    };
  },
};
