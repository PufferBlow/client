import { beforeEach, describe, expect, it } from "vitest";
import { calledUrl, jsonResponse, mockFetch, signIn } from "../../test/helpers";
import { applyVoiceAction, joinVoiceSession, leaveVoiceSession, listVoiceParticipants } from "./api";
import { parseSignal, signal } from "./signaling";

describe("parseSignal", () => {
  const frame = (value: unknown) => JSON.stringify(value);

  it("reads the participant snapshot from joined", () => {
    expect(
      parseSignal(
        frame({
          type: "joined",
          session_id: "s",
          participants: [
            { user_id: "u1", username: "ada", is_muted: true, is_deafened: false, is_speaking: false, is_sharing_screen: false, scope: "x", connected_at: "t" },
            { username: "no id" },
          ],
        }),
      ),
    ).toEqual({ type: "joined", participants: [{ userId: "u1", username: "ada", isMuted: true, isDeafened: false, isSpeaking: false }] });
  });

  it("reads joins, leaves and speaker levels from the payload", () => {
    expect(parseSignal(frame({ type: "participant_joined", payload: { user_id: "u2", username: "grace", participant_count: 2 } }))).toEqual({
      type: "participant_joined",
      userId: "u2",
      username: "grace",
    });
    expect(parseSignal(frame({ type: "participant_left", payload: { user_id: "u2", participant_count: 1 } }))).toEqual({ type: "participant_left", userId: "u2" });
    expect(parseSignal(frame({ type: "speaker_levels", payload: { user_id: "u2", is_speaking: true, is_muted: false, is_deafened: true } }))).toEqual({
      type: "speaker_levels",
      userId: "u2",
      isSpeaking: true,
      isMuted: false,
      isDeafened: true,
    });
  });

  it("reads negotiation frames", () => {
    expect(parseSignal(frame({ type: "offer", offer: { type: "offer", sdp: "x" } }))).toEqual({ type: "offer", sdp: { type: "offer", sdp: "x" } });
    expect(parseSignal(frame({ type: "answer", answer: { type: "answer", sdp: "y" } }))).toEqual({ type: "answer", sdp: { type: "answer", sdp: "y" } });
    expect(parseSignal(frame({ type: "candidate", candidate: { candidate: "c", sdpMid: "0" } }))).toEqual({ type: "candidate", candidate: { candidate: "c", sdpMid: "0" } });
  });

  it("reads acks and errors", () => {
    expect(parseSignal(frame({ type: "leave_ack" }))).toEqual({ type: "leave_ack" });
    expect(parseSignal(frame({ type: "pong", session_id: "s" }))).toEqual({ type: "pong" });
    expect(parseSignal(frame({ type: "error", error: "already connected in this session" }))).toEqual({ type: "error", message: "already connected in this session" });
    expect(parseSignal(frame({ type: "error" }))).toMatchObject({ type: "error" });
  });

  it.each([["not json"], [frame([1])], [frame({ type: "something_new" })], [frame({ type: "participant_left", payload: {} })], [frame({ type: "offer" })], [null], [new ArrayBuffer(2)]])(
    "ignores unknown or malformed frames (%j)",
    (input) => {
      expect(parseSignal(input)).toBeNull();
    },
  );
});

describe("signal builders", () => {
  it("match what the media server reads", () => {
    expect(JSON.parse(signal.offer({ type: "offer", sdp: "o" }))).toEqual({ type: "offer", offer: { type: "offer", sdp: "o" } });
    expect(JSON.parse(signal.answer({ type: "answer", sdp: "a" }))).toEqual({ type: "answer", answer: { type: "answer", sdp: "a" } });
    expect(JSON.parse(signal.candidate({ candidate: "c" }))).toEqual({ type: "candidate", candidate: { candidate: "c" } });
    expect(JSON.parse(signal.ping())).toEqual({ type: "ping" });
    expect(JSON.parse(signal.leave())).toEqual({ type: "leave" });
  });

  it("sends only the audio state that changed", () => {
    expect(JSON.parse(signal.audioState({ isMuted: true }))).toEqual({ type: "audio_state", audio_state: { is_muted: true } });
    expect(JSON.parse(signal.audioState({ isDeafened: false, isSpeaking: true }))).toEqual({
      type: "audio_state",
      audio_state: { is_deafened: false, is_speaking: true },
    });
  });
});

describe("voice API", () => {
  beforeEach(() => signIn("tok"));

  it("joins with the token in the body and maps the grant", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        status_code: 200,
        session_id: "s1",
        channel_id: "v 1",
        join_token: "jt",
        signaling_url: "wss://sfu.example/rtc/v1/ws",
        ice_servers: [{ urls: "stun:x" }],
        participant_count: 3,
        quality_profile: "high",
      }),
    );
    const grant = await joinVoiceSession("v 1", "high");

    expect(calledUrl(fetchMock).pathname).toBe("/api/v2/voice/channels/v%201/sessions");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ quality_profile: "high", auth_token: "tok" });
    expect(grant).toEqual({
      sessionId: "s1",
      channelId: "v 1",
      joinToken: "jt",
      signalingUrl: "wss://sfu.example/rtc/v1/ws",
      iceServers: [{ urls: "stun:x" }],
      participantCount: 3,
      qualityProfile: "high",
    });
  });

  it("defaults the ICE servers and quality when the API omits them", async () => {
    mockFetch(jsonResponse({ session_id: "s", channel_id: "c", join_token: "t", signaling_url: "ws://x" }));
    expect(await joinVoiceSession("c")).toMatchObject({ iceServers: [], participantCount: 0, qualityProfile: "balanced" });
  });

  it("leaves a session", async () => {
    const fetchMock = mockFetch(jsonResponse({ status_code: 200 }));
    await leaveVoiceSession("s1");
    expect(calledUrl(fetchMock).pathname).toBe("/api/v2/voice/sessions/s1/leave");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ auth_token: "tok" });
  });

  it("lists connected participants with the token in the query", async () => {
    const fetchMock = mockFetch(
      jsonResponse({
        participants: [
          { user_id: "u1", username: "ada", is_connected: true, is_muted: true },
          { user_id: "u2", username: "gone", is_connected: false },
        ],
        participant_count: 1,
        session_id: "s",
      }),
    );
    const list = await listVoiceParticipants("v1");
    expect(calledUrl(fetchMock).searchParams.get("auth_token")).toBe("tok");
    expect(list).toEqual([{ userId: "u1", username: "ada", isMuted: true, isDeafened: false, isSpeaking: false }]);
  });

  it("applies a mute or deafen action", async () => {
    const fetchMock = mockFetch(jsonResponse({}));
    await applyVoiceAction("s1", "mute_self", true);
    expect(calledUrl(fetchMock).pathname).toBe("/api/v2/voice/sessions/s1/actions");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ auth_token: "tok", action: "mute_self", payload: { value: true } });
  });
});
