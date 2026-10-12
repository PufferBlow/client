import { beforeEach, describe, expect, it } from "vitest";
import { act, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { Channel } from "../../features/channels/types";
import { VoiceProvider } from "../../features/voice/VoiceProvider";
import type { VoiceDeps } from "../../features/voice/transport";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ChannelSidebar } from "./ChannelSidebar";

beforeEach(() => signIn("tok"));

const channels: Channel[] = [
  { channel_id: "c1", channel_name: "general", channel_type: "text", is_private: false, created_at: "t" },
  { channel_id: "v1", channel_name: "Lounge", channel_type: "voice", is_private: false, created_at: "t" },
  { channel_id: "v2", channel_name: "Stand-up", channel_type: "voice", is_private: false, created_at: "t" },
];

const me = { user_id: "me", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "x", roles_ids: [], resolved_privileges: [] };

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: Record<string, unknown>[] = [];
  closed = false;
  onopen: (() => void) | null = null;
  onmessage: ((e: MessageEvent) => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.all.push(this);
    void Promise.resolve().then(() => {
      this.readyState = 1;
      this.onopen?.();
    });
  }
  send(text: string) {
    this.sent.push(JSON.parse(text));
  }
  close() {
    this.closed = true;
  }
  receive(frame: unknown) {
    this.onmessage?.({ data: JSON.stringify(frame) } as MessageEvent);
  }
  drop() {
    this.onclose?.();
  }
}

class FakePeer {
  onicecandidate = null;
  ontrack = null;
  onconnectionstatechange = null;
  signalingState = "stable";
  remoteDescription = null;
  closed = false;
  addTrack() {}
  async createOffer() {
    return { type: "offer", sdp: "o" };
  }
  async setLocalDescription() {}
  close() {
    this.closed = true;
  }
}

let micError: unknown = null;
let micTracks: { enabled: boolean; stopped: boolean }[] = [];

const deps: VoiceDeps = {
  createSocket: (url) => new FakeSocket(url) as unknown as WebSocket,
  createPeer: () => new FakePeer() as unknown as RTCPeerConnection,
  getMicrophone: async () => {
    if (micError) throw micError;
    const track = { enabled: true, stopped: false, stop() { this.stopped = true; } };
    micTracks.push(track);
    return { getAudioTracks: () => [track], getTracks: () => [track] } as unknown as MediaStream;
  },
  createAudio: () => ({ play: async () => undefined, pause() {}, muted: false, srcObject: null }) as unknown as HTMLAudioElement,
  watchSpeaking: () => () => undefined,
};

const grant = (channel: string) => ({
  session_id: `sess-${channel}`,
  channel_id: channel,
  join_token: `token-${channel}`,
  signaling_url: "ws://sfu.test/rtc/v1/ws",
  ice_servers: [{ urls: "stun:stun.test" }],
  participant_count: 1,
  quality_profile: "balanced",
});

const bodyOf = (fetchMock: ReturnType<typeof routeFetch>, method: string, path: string) => {
  const call = fetchMock.mock.calls.find(([input, init]) => new URL(String(input)).pathname === path && (init?.method ?? "GET").toUpperCase() === method);
  return call ? JSON.parse(String(call[1]!.body)) : undefined;
};

function backend(extra: Record<string, unknown> = {}) {
  return routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "POST /api/v1/channels/list/": { channels },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Test Server" } },
    "GET /api/v1/notifications/preferences": { preferences: [] },
    "GET /api/v2/voice/channels/v1/participants": { participants: [{ user_id: "u2", username: "grace", is_connected: true, is_muted: true }], participant_count: 1, session_id: "s" },
    "GET /api/v2/voice/channels/v2/participants": { participants: [], participant_count: 0, session_id: null },
    "POST /api/v2/voice/channels/v1/sessions": () => jsonResponse(grant("v1")),
    "POST /api/v2/voice/channels/v2/sessions": () => jsonResponse(grant("v2")),
    "POST /api/v2/voice/sessions/sess-v1/leave": { status_code: 200 },
    "POST /api/v2/voice/sessions/sess-v2/leave": { status_code: 200 },
    "POST /api/v2/voice/sessions/sess-v1/actions": { status_code: 200 },
    "POST /api/v2/voice/sessions/sess-v2/actions": { status_code: 200 },
    ...extra,
  });
}

async function open(extra?: Record<string, unknown>) {
  micError = null;
  micTracks = [];
  FakeSocket.all = [];
  const fetchMock = backend(extra);
  const user = userEvent.setup();
  renderWithProviders(
    <VoiceProvider deps={deps}>
      <ChannelSidebar />
    </VoiceProvider>,
    { route: "/dashboard/channels/c1", path: "/dashboard/channels/:channelId" },
  );
  await screen.findByRole("button", { name: /Join voice channel Lounge/ });
  await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/users/profile"));
  await act(async () => {});
  return { fetchMock, user };
}

const socket = () => FakeSocket.all.at(-1)!;
const joinedFrame = (...users: [string, string][]) => ({ type: "joined", participants: users.map(([id, name]) => ({ user_id: id, username: name })) });

async function joinLounge(extra?: Record<string, unknown>) {
  const view = await open(extra);
  await view.user.click(screen.getByRole("button", { name: /Join voice channel Lounge/ }));
  await waitFor(() => expect(FakeSocket.all).toHaveLength(1));
  await act(async () => socket().receive(joinedFrame(["me", "ada"], ["u2", "grace"])));
  await screen.findByText("Voice connected");
  return view;
}

describe("voice channels in the sidebar", () => {
  it("lists who is in each call, and their mute state, without joining", async () => {
    await open();
    const roster = await screen.findByRole("list", { name: "In this call" });
    expect(within(roster).getByText("grace")).toBeInTheDocument();
    expect(within(roster).getByLabelText("Muted")).toBeInTheDocument();
  });

  it("has mute and deafen disabled until you are in a call", async () => {
    await open();
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Deafen" })).toBeDisabled();
    expect(screen.queryByText("Voice connected")).not.toBeInTheDocument();
  });

  it("joins: gets a session from the API, opens the media socket with its token, and shows the call", async () => {
    const { fetchMock } = await joinLounge();

    expect(bodyOf(fetchMock, "POST", "/api/v2/voice/channels/v1/sessions")).toEqual({ auth_token: "tok", quality_profile: "balanced" });
    expect(socket().url).toBe("ws://sfu.test/rtc/v1/ws?join_token=token-v1");
    expect(screen.getByText("Voice connected").closest("[role=status]")).toHaveTextContent("Lounge");
    expect(screen.getByRole("button", { name: /Lounge, connected/ })).toHaveAttribute("aria-pressed", "true");
    // Now the live roster is shown: you and grace.
    const roster = screen.getByRole("list", { name: "In this call" });
    expect(within(roster).getAllByRole("listitem")).toHaveLength(2);
    expect(within(roster).getByText("ada")).toBeInTheDocument();
    expect(within(roster).getByText("grace")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeEnabled();
  });

  it("shows a connecting state until the media server confirms", async () => {
    const { user } = await open();
    await user.click(screen.getByRole("button", { name: /Join voice channel Lounge/ }));
    expect(await screen.findByText("Connecting…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join voice channel Lounge/ })).toBeDisabled();
    await act(async () => socket().receive(joinedFrame(["me", "ada"])));
    expect(await screen.findByText("Voice connected")).toBeInTheDocument();
  });

  it("mutes: the button, the microphone, the roster and the API all agree", async () => {
    const { user, fetchMock } = await joinLounge();
    await user.click(screen.getByRole("button", { name: "Mute microphone" }));

    expect(screen.getByRole("button", { name: "Unmute microphone" })).toHaveAttribute("aria-pressed", "true");
    expect(micTracks[0]!.enabled).toBe(false);
    expect(socket().sent.at(-1)).toEqual({ type: "audio_state", audio_state: { is_muted: true, is_speaking: false } });
    await waitFor(() => expect(bodyOf(fetchMock, "POST", "/api/v2/voice/sessions/sess-v1/actions")).toEqual({ auth_token: "tok", action: "mute_self", payload: { value: true } }));
    expect(within(screen.getByRole("list", { name: "In this call" })).getAllByLabelText("Muted")).toHaveLength(1);

    await user.click(screen.getByRole("button", { name: "Unmute microphone" }));
    expect(micTracks[0]!.enabled).toBe(true);
  });

  it("deafening also mutes, and undeafening restores what you had", async () => {
    const { user } = await joinLounge();

    await user.click(screen.getByRole("button", { name: "Deafen" }));
    expect(screen.getByRole("button", { name: "Undeafen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Unmute microphone" })).toBeInTheDocument();
    expect(micTracks[0]!.enabled).toBe(false);

    await user.click(screen.getByRole("button", { name: "Undeafen" }));
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeInTheDocument();
    expect(micTracks[0]!.enabled).toBe(true);
  });

  it("unmuting while deafened also undeafens", async () => {
    const { user } = await joinLounge();
    await user.click(screen.getByRole("button", { name: "Deafen" }));
    await user.click(screen.getByRole("button", { name: "Unmute microphone" }));
    expect(screen.getByRole("button", { name: "Deafen" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeInTheDocument();
  });

  it("leaves from the bar: tells the media server and the API, and releases the microphone", async () => {
    const { user, fetchMock } = await joinLounge();
    await user.click(screen.getByRole("button", { name: "Leave voice channel" }));

    await waitFor(() => expect(screen.queryByText("Voice connected")).not.toBeInTheDocument());
    expect(socket().sent.at(-1)).toEqual({ type: "leave" });
    expect(socket().closed).toBe(true);
    expect(micTracks[0]!.stopped).toBe(true);
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v2/voice/sessions/sess-v1/leave"));
    expect(screen.getByRole("button", { name: "Mute microphone" })).toBeDisabled();
  });

  it("leaves by clicking the connected channel again", async () => {
    const { user } = await joinLounge();
    await user.click(screen.getByRole("button", { name: /Lounge, connected/ }));
    await waitFor(() => expect(screen.queryByText("Voice connected")).not.toBeInTheDocument());
  });

  it("joining a second channel leaves the first", async () => {
    const { user, fetchMock } = await joinLounge();
    await user.click(screen.getByRole("button", { name: /Join voice channel Stand-up/ }));

    await waitFor(() => expect(FakeSocket.all).toHaveLength(2));
    expect(FakeSocket.all[0]!.closed).toBe(true);
    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v2/voice/sessions/sess-v1/leave"));
    await act(async () => socket().receive(joinedFrame(["me", "ada"])));
    expect(await screen.findByRole("button", { name: /Stand-up, connected/ })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Join voice channel Lounge/ })).toBeInTheDocument();
  });

  describe("when it goes wrong", () => {
    it("shows the API's refusal and offers to rejoin", async () => {
      const { user } = await open({ "POST /api/v2/voice/channels/v1/sessions": () => jsonResponse({ detail: "Channel does not support voice sessions" }, 400) });
      await user.click(screen.getByRole("button", { name: /Join voice channel Lounge/ }));

      const alert = await screen.findByRole("alert");
      expect(alert).toBeInTheDocument();
      expect(within(alert).getByRole("button", { name: /Rejoin Lounge/ })).toBeInTheDocument();
      expect(FakeSocket.all).toHaveLength(0);
    });

    it("explains a blocked microphone and frees the seat it was given", async () => {
      const { user, fetchMock } = await open();
      micError = new DOMException("denied", "NotAllowedError");
      await user.click(screen.getByRole("button", { name: /Join voice channel Lounge/ }));

      expect(await screen.findByRole("alert")).toHaveTextContent(/microphone access was blocked/i);
      await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v2/voice/sessions/sess-v1/leave"));
      expect(FakeSocket.all).toHaveLength(0);
    });

    it("recovers by rejoining after a dropped connection", async () => {
      const { user, fetchMock } = await joinLounge();
      act(() => socket().drop());

      const alert = await screen.findByRole("alert");
      expect(alert).toHaveTextContent(/connection to the voice server was lost/i);
      await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v2/voice/sessions/sess-v1/leave"));

      await user.click(within(alert).getByRole("button", { name: /Rejoin Lounge/ }));
      await waitFor(() => expect(FakeSocket.all).toHaveLength(2));
      await act(async () => socket().receive(joinedFrame(["me", "ada"])));
      expect(await screen.findByText("Voice connected")).toBeInTheDocument();
    });

    it("dismisses a failed call", async () => {
      const { user } = await joinLounge();
      act(() => socket().drop());
      await user.click(await screen.findByRole("button", { name: "Dismiss" }));
      expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    });
  });
});
