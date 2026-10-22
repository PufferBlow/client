import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { VoiceError, VoiceTransport, type VoiceDeps, type VoiceEvents } from "./transport";
import type { VoiceParticipant, VoiceSessionGrant, VoiceStatus } from "./types";

class FakeSocket {
  static last: FakeSocket;
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closeArgs: unknown[] | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.last = this;
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close(...args: unknown[]) {
    this.closeArgs = args;
    this.readyState = 3;
  }
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }
  drop() {
    this.readyState = 3;
    this.onclose?.();
  }
  types() {
    return this.sent.map((f) => f.type);
  }
}

class FakePeer {
  static last: FakePeer;
  signalingState = "stable";
  connectionState = "new";
  remoteDescription: unknown = null;
  tracks: unknown[] = [];
  candidatesAdded: unknown[] = [];
  descriptions: unknown[] = [];
  closed = false;
  onicecandidate: ((e: { candidate: { toJSON: () => unknown } | null }) => void) | null = null;
  ontrack: ((e: unknown) => void) | null = null;
  onconnectionstatechange: (() => void) | null = null;
  constructor(public config: RTCConfiguration) {
    FakePeer.last = this;
  }
  addTrack(track: unknown) {
    this.tracks.push(track);
  }
  async createOffer() {
    return { type: "offer", sdp: "local-offer" };
  }
  async createAnswer() {
    return { type: "answer", sdp: "local-answer" };
  }
  async setLocalDescription(d: { type: string }) {
    this.descriptions.push(d);
    this.signalingState = d.type === "offer" ? "have-local-offer" : d.type === "rollback" ? "stable" : "stable";
  }
  async setRemoteDescription(d: unknown) {
    this.remoteDescription = d;
    this.signalingState = "stable";
  }
  async addIceCandidate(c: unknown) {
    this.candidatesAdded.push(c);
  }
  close() {
    this.closed = true;
  }
}

const track = () => ({ enabled: true, stopped: false, stop() { this.stopped = true; } });

const grant: VoiceSessionGrant = {
  sessionId: "sess1",
  channelId: "v1",
  joinToken: "tok en",
  signalingUrl: "ws://sfu.example:8787/rtc/v1/ws",
  iceServers: [{ urls: "stun:stun.example:3478" }, { urls: ["turn:turn.example:3478"], username: "u", credential: "c" }],
  participantCount: 0,
  qualityProfile: "balanced",
};

const flush = () => vi.advanceTimersByTimeAsync(0);

describe("VoiceTransport", () => {
  let statuses: { status: VoiceStatus; error?: string }[];
  let roster: VoiceParticipant[];
  let mic: ReturnType<typeof track>;
  let audios: { srcObject: unknown; muted: boolean; paused: boolean }[];
  let speakingCallback: ((speaking: boolean) => void) | null;
  let stopWatching: ReturnType<typeof vi.fn<() => void>>;
  let micError: unknown;

  const events: VoiceEvents = {
    onStatus: (status, error) => statuses.push({ status, error }),
    onParticipants: (participants) => (roster = participants),
  };

  const makeDeps = (): VoiceDeps => ({
    createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
    createPeer: (config) => new FakePeer(config) as unknown as RTCPeerConnection,
    getMicrophone: async () => {
      if (micError) throw micError;
      return { getAudioTracks: () => [mic], getTracks: () => [mic] } as unknown as MediaStream;
    },
    createAudio: () => {
      const audio = { srcObject: null as unknown, muted: false, paused: false, autoplay: false, play: async () => undefined, pause() { this.paused = true; } };
      audios.push(audio);
      return audio as unknown as HTMLAudioElement;
    },
    watchSpeaking: (_stream, onChange) => {
      speakingCallback = onChange;
      return stopWatching;
    },
  });

  const start = async () => {
    const transport = new VoiceTransport(grant, { userId: "me", username: "ada" }, events, makeDeps());
    const connecting = transport.connect();
    await flush();
    FakeSocket.last.open();
    await connecting;
    return transport;
  };

  const join = (participants: unknown[] = [{ user_id: "me", username: "ada" }, { user_id: "u2", username: "grace" }]) =>
    FakeSocket.last.receive({ type: "joined", session_id: "sess1", participants });

  beforeEach(() => {
    vi.useFakeTimers();
    statuses = [];
    roster = [];
    audios = [];
    mic = track();
    micError = null;
    speakingCallback = null;
    stopWatching = vi.fn<() => void>();
  });
  afterEach(() => vi.useRealTimers());

  it("connects with the one-time token in the URL, offers the microphone and joins", async () => {
    await start();
    expect(FakeSocket.last.url).toBe("ws://sfu.example:8787/rtc/v1/ws?join_token=tok%20en");
    expect(statuses[0]).toEqual({ status: "connecting", error: undefined });
    expect(FakePeer.last.tracks).toEqual([mic]);
    expect(FakeSocket.last.sent).toEqual([
      { type: "join", session_id: "sess1" },
      { type: "offer", offer: { type: "offer", sdp: "local-offer" } },
    ]);
  });

  it("hands the ICE servers to the peer connection, with TURN credentials", async () => {
    await start();
    expect(FakePeer.last.config.iceServers).toEqual([{ urls: "stun:stun.example:3478" }, { urls: ["turn:turn.example:3478"], username: "u", credential: "c" }]);
  });

  it("appends the token with & when the URL already has a query", async () => {
    const transport = new VoiceTransport({ ...grant, signalingUrl: "ws://sfu/rtc/v1/ws?region=eu" }, { userId: "me", username: "ada" }, events, makeDeps());
    const connecting = transport.connect();
    await flush();
    expect(FakeSocket.last.url).toBe("ws://sfu/rtc/v1/ws?region=eu&join_token=tok%20en");
    FakeSocket.last.open();
    await connecting;
  });

  it("applies the server's answer and sends our ICE candidates", async () => {
    await start();
    FakeSocket.last.receive({ type: "answer", session_id: "s", answer: { type: "answer", sdp: "remote-answer" } });
    await flush();
    expect(FakePeer.last.remoteDescription).toEqual({ type: "answer", sdp: "remote-answer" });

    FakePeer.last.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: "c1" }) } });
    FakePeer.last.onicecandidate?.({ candidate: null });
    expect(FakeSocket.last.sent.filter((f) => f.type === "candidate")).toEqual([{ type: "candidate", candidate: { candidate: "c1" } }]);
  });

  it("queues remote candidates that arrive before a remote description, then applies them", async () => {
    await start();
    FakeSocket.last.receive({ type: "candidate", candidate: { candidate: "early" } });
    await flush();
    expect(FakePeer.last.candidatesAdded).toEqual([]);

    FakeSocket.last.receive({ type: "answer", answer: { type: "answer", sdp: "a" } });
    await flush();
    expect(FakePeer.last.candidatesAdded).toEqual([{ candidate: "early" }]);

    FakeSocket.last.receive({ type: "candidate", candidate: { candidate: "late" } });
    await flush();
    expect(FakePeer.last.candidatesAdded).toEqual([{ candidate: "early" }, { candidate: "late" }]);
  });

  it("answers an offer from the server, setting aside our own unanswered offer", async () => {
    await start();
    expect(FakePeer.last.signalingState).toBe("have-local-offer");
    FakeSocket.last.receive({ type: "offer", offer: { type: "offer", sdp: "server-offer" } });
    await flush();

    expect(FakePeer.last.descriptions).toContainEqual({ type: "rollback" });
    expect(FakePeer.last.remoteDescription).toEqual({ type: "offer", sdp: "server-offer" });
    // The server drops our offer when it has one out, so ours goes again after its offer is answered.
    expect(FakeSocket.last.types().slice(-2)).toEqual(["answer", "offer"]);
    expect(FakeSocket.last.sent.at(-2)).toEqual({ type: "answer", answer: { type: "answer", sdp: "local-answer" } });
  });

  it("holds its own ICE candidates until its offer has been sent", async () => {
    await start();
    const sent = FakeSocket.last.types();
    expect(sent.indexOf("offer")).toBeGreaterThan(-1);
    FakePeer.last.onicecandidate?.({ candidate: { toJSON: () => ({ candidate: "c1" }) } } as unknown as RTCPeerConnectionIceEvent);
    expect(FakeSocket.last.types().at(-1)).toBe("candidate"); // after the offer: sent straight away
  });

  it("reports connected and the roster when the server confirms the join, and pings from then on", async () => {
    await start();
    expect(statuses.at(-1)?.status).toBe("connecting");
    join();
    await flush();

    expect(statuses.at(-1)).toEqual({ status: "connected", error: undefined });
    expect(roster.map((p) => p.username)).toEqual(["ada", "grace"]);

    await vi.advanceTimersByTimeAsync(20_000);
    expect(FakeSocket.last.types().filter((t) => t === "ping")).toHaveLength(1);
  });

  it("adds ourselves to the roster if the server's list leaves us out", async () => {
    await start();
    join([{ user_id: "u2", username: "grace" }]);
    await flush();
    expect(roster.map((p) => p.userId).sort()).toEqual(["me", "u2"]);
  });

  it("follows people joining, leaving and speaking", async () => {
    await start();
    join();
    FakeSocket.last.receive({ type: "participant_joined", payload: { user_id: "u3", username: "linus" } });
    FakeSocket.last.receive({ type: "participant_joined", payload: { user_id: "u3", username: "linus" } }); // repeat
    await flush();
    expect(roster.map((p) => p.username)).toEqual(["ada", "grace", "linus"]);

    FakeSocket.last.receive({ type: "speaker_levels", payload: { user_id: "u2", is_speaking: true, is_muted: false, is_deafened: false } });
    await flush();
    expect(roster.find((p) => p.userId === "u2")?.isSpeaking).toBe(true);

    FakeSocket.last.receive({ type: "participant_left", payload: { user_id: "u2" } });
    await flush();
    expect(roster.map((p) => p.userId)).toEqual(["me", "u3"]);
  });

  it("plays remote audio once per stream and silences it while deafened", async () => {
    const transport = await start();
    join();
    const stream = { id: "stream-1" };
    FakePeer.last.ontrack?.({ track: { kind: "audio" }, streams: [stream] });
    FakePeer.last.ontrack?.({ track: { kind: "audio" }, streams: [stream] });
    FakePeer.last.ontrack?.({ track: { kind: "video" }, streams: [{ id: "v" }] });
    expect(audios).toHaveLength(1);
    expect(audios[0]!.srcObject).toBe(stream);

    transport.setDeafened(true);
    expect(audios[0]!.muted).toBe(true);
    transport.setDeafened(false);
    expect(audios[0]!.muted).toBe(false);
  });

  it("mutes the microphone and tells the server, and the roster follows", async () => {
    const transport = await start();
    join();
    await flush();

    transport.setMuted(true);
    expect(mic.enabled).toBe(false);
    expect(transport.isMuted).toBe(true);
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: "audio_state", audio_state: { is_muted: true, is_speaking: false } });
    expect(roster.find((p) => p.userId === "me")?.isMuted).toBe(true);

    transport.setMuted(false);
    expect(mic.enabled).toBe(true);
  });

  it("tells the server about deafening", async () => {
    const transport = await start();
    join();
    transport.setDeafened(true);
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: "audio_state", audio_state: { is_deafened: true } });
    expect(transport.isDeafened).toBe(true);
  });

  it("re-sends mute and deafen state it was given before the join was confirmed", async () => {
    const transport = await start();
    transport.setMuted(true);
    join();
    await flush();
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: "audio_state", audio_state: { is_muted: true, is_deafened: false } });
  });

  it("reports when you start and stop speaking, debounced, and never while muted", async () => {
    const transport = await start();
    join();
    await flush();

    speakingCallback?.(true);
    expect(FakeSocket.last.sent.filter((f) => f.type === "audio_state")).toHaveLength(0);
    await vi.advanceTimersByTimeAsync(200);
    expect(FakeSocket.last.sent.at(-1)).toEqual({ type: "audio_state", audio_state: { is_speaking: true } });
    expect(roster.find((p) => p.userId === "me")?.isSpeaking).toBe(true);

    speakingCallback?.(false);
    await vi.advanceTimersByTimeAsync(200);
    expect(roster.find((p) => p.userId === "me")?.isSpeaking).toBe(false);

    transport.setMuted(true);
    const before = FakeSocket.last.sent.length;
    speakingCallback?.(true);
    await vi.advanceTimersByTimeAsync(300);
    expect(FakeSocket.last.sent).toHaveLength(before);
  });

  it("leaves cleanly: says goodbye, closes everything and releases the microphone", async () => {
    const transport = await start();
    join();
    FakePeer.last.ontrack?.({ track: { kind: "audio" }, streams: [{ id: "s" }] });
    const socket = FakeSocket.last;
    const peer = FakePeer.last;

    transport.disconnect();

    expect(socket.sent.at(-1)).toEqual({ type: "leave" });
    expect(socket.closeArgs).toEqual([1000, "leaving"]);
    expect(peer.closed).toBe(true);
    expect(mic.stopped).toBe(true);
    expect(audios[0]!.paused).toBe(true);
    expect(stopWatching).toHaveBeenCalled();
    expect(statuses.at(-1)?.status).toBe("idle");
    transport.disconnect(); // idempotent
    expect(statuses.filter((s) => s.status === "idle")).toHaveLength(1);
  });

  it("stops pinging after it has left", async () => {
    const transport = await start();
    join();
    const socket = FakeSocket.last;
    transport.disconnect();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(socket.types().filter((t) => t === "ping")).toHaveLength(0);
  });

  describe("failures", () => {
    it("explains a blocked microphone and never opens a connection", async () => {
      micError = new DOMException("denied", "NotAllowedError");
      const before = FakeSocket.last;
      const transport = new VoiceTransport(grant, { userId: "me", username: "ada" }, events, makeDeps());
      await expect(transport.connect()).rejects.toMatchObject({ kind: "microphone" });
      expect(statuses.at(-1)?.status).toBe("failed");
      expect(statuses.at(-1)?.error).toMatch(/blocked/i);
      expect(FakeSocket.last).toBe(before);
    });

    it("says so when there is no microphone", async () => {
      micError = new DOMException("none", "NotFoundError");
      const transport = new VoiceTransport(grant, { userId: "me", username: "ada" }, events, makeDeps());
      await expect(transport.connect()).rejects.toBeInstanceOf(VoiceError);
      expect(statuses.at(-1)?.error).toMatch(/no microphone/i);
    });

    it("fails and releases the microphone when the media server cannot be reached", async () => {
      const transport = new VoiceTransport(grant, { userId: "me", username: "ada" }, events, makeDeps());
      const connecting = transport.connect();
      const assertion = expect(connecting).rejects.toMatchObject({ kind: "connection" });
      await flush();
      FakeSocket.last.drop();
      await assertion;
      expect(statuses.at(-1)).toEqual({ status: "failed", error: "Couldn't reach the voice server." });
      expect(mic.stopped).toBe(true);
      expect(FakePeer.last.closed).toBe(true);
    });

    it("fails when the connection drops mid-call", async () => {
      await start();
      join();
      await flush();
      FakeSocket.last.drop();
      expect(statuses.at(-1)).toEqual({ status: "failed", error: "The connection to the voice server was lost." });
      expect(mic.stopped).toBe(true);
    });

    it("fails with the server's own words when it rejects the join", async () => {
      await start();
      FakeSocket.last.receive({ type: "error", error: "already connected in this session" });
      await flush();
      expect(statuses.at(-1)).toEqual({ status: "failed", error: "already connected in this session" });
    });

    it("fails when the media path fails", async () => {
      await start();
      join();
      FakePeer.last.connectionState = "failed";
      FakePeer.last.onconnectionstatechange?.();
      expect(statuses.at(-1)).toEqual({ status: "failed", error: "The audio connection failed." });
    });

    it("fails when the server never confirms the join", async () => {
      await start();
      await vi.advanceTimersByTimeAsync(15_000);
      expect(statuses.at(-1)).toEqual({ status: "failed", error: "The voice server did not confirm the join." });
    });

    it("reports a failure once, and ignores frames that arrive afterwards", async () => {
      await start();
      join();
      FakeSocket.last.receive({ type: "error", error: "boom" });
      await flush();
      FakePeer.last.onconnectionstatechange?.();
      FakeSocket.last.receive({ type: "participant_joined", payload: { user_id: "u9", username: "late" } });
      await flush();
      expect(statuses.filter((s) => s.status === "failed")).toHaveLength(1);
    });

    it("quietly drops out when the caller leaves while still connecting", async () => {
      const transport = new VoiceTransport(grant, { userId: "me", username: "ada" }, events, makeDeps());
      const connecting = transport.connect();
      await flush();
      transport.disconnect();
      await expect(connecting).resolves.toBeUndefined();
      expect(statuses.some((s) => s.status === "failed")).toBe(false);
      expect(mic.stopped).toBe(true);
    });

    it("ignores malformed frames", async () => {
      await start();
      FakeSocket.last.onmessage?.({ data: "not json" } as MessageEvent);
      FakeSocket.last.receive({ type: "something_new" });
      FakeSocket.last.receive({ type: "participant_left", payload: {} });
      await flush();
      expect(statuses.some((s) => s.status === "failed")).toBe(false);
    });
  });
});
