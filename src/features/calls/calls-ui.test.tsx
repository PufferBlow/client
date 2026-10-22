import { beforeEach, describe, expect, it } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { CallOverlay } from "../../components/dashboard/CallOverlay";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { useCall } from "./callContext";
import { CallProvider } from "./CallProvider";
import { memoryKeyStore } from "./crypto/identity";
import { memoryPinStore } from "./crypto/trust";
import type { CallDeps } from "./engine";
import { callSignals } from "./signals";

beforeEach(() => signIn("tok"));

const me = { user_id: "u1", username: "ada", about: null, status: "online", accent_color: null, avatar_url: null, origin_server: "localhost:7575", roles_ids: [] };
const grace = { ...me, user_id: "u2", username: "grace" };

class FakeStream {
  track = { enabled: true, stop: () => undefined };
  getAudioTracks() {
    return [this.track];
  }
  getTracks() {
    return [this.track];
  }
}

const deps: CallDeps = {
  createPeer: () =>
    ({
      addTrack: () => undefined,
      createOffer: async () => ({ type: "offer", sdp: "v=0\r\na=fingerprint:sha-256 AA:BB\r\n" }),
      setLocalDescription: async () => undefined,
      close: () => undefined,
    }) as unknown as RTCPeerConnection,
  getMicrophone: async () => new FakeStream() as unknown as MediaStream,
  createAudio: () => ({}) as HTMLAudioElement,
};

function backend(extra: Record<string, unknown> = {}) {
  return routeFetch({
    "POST /api/v1/users/profile": { user_data: me },
    "GET /api/v1/users/list": { users: [me, grace] },
    "PUT /api/v1/identity-keys": { created: true },
    "POST /api/v1/dm-calls/u2/invite": { call_id: "call-1", ice_servers: [] },
    "POST /api/v1/dm-calls/call-1/accept": { ice_servers: [] },
    "POST /api/v1/dm-calls/call-1/reject": {},
    "POST /api/v1/dm-calls/call-1/end": {},
    "POST /api/v1/dm-calls/call-1/signal": {},
    "POST /api/v1/dm-calls/call-2/reject": {},
    ...extra,
  });
}

function Dial() {
  const call = useCall();
  return (
    <button type="button" onClick={() => void call.startCall({ userId: "u2", name: "grace" })}>
      dial
    </button>
  );
}

const renderCalls = () =>
  renderWithProviders(
    <CallProvider deps={deps} keyStore={memoryKeyStore()} pinStore={() => memoryPinStore()}>
      <Dial />
      <CallOverlay />
    </CallProvider>,
  );

const ring = (callId = "call-1", callerId = "u2") => act(() => callSignals.emit({ kind: "invite", callId, callerId }));

describe("incoming calls", () => {
  it("rings with who is calling, and says the call is end-to-end encrypted", async () => {
    backend();
    renderCalls();
    await screen.findByRole("button", { name: "dial" }); // profile and members loaded
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());

    ring();

    const dialog = await screen.findByRole("alertdialog", { name: "Incoming call from grace" });
    expect(dialog).toHaveTextContent("end-to-end encrypted");
  });

  it("declines: tells the instance and clears the card", async () => {
    const fetchMock = backend();
    const { user } = renderCalls();
    ring();
    await user.click(await screen.findByRole("button", { name: /decline/i }));

    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
    expect(requestLog(fetchMock)).toContain("POST /api/v1/dm-calls/call-1/reject");
  });

  it("turns away a second call while one is ringing, as a decline", async () => {
    const fetchMock = backend();
    renderCalls();
    ring("call-1");
    await screen.findByRole("alertdialog", { name: /Incoming call from/ });

    ring("call-2", "u3");

    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/dm-calls/call-2/reject"));
    expect(screen.getAllByRole("alertdialog")).toHaveLength(1);
  });

  it("shows a missed call when the caller gives up", async () => {
    backend();
    renderCalls();
    ring();
    await screen.findByRole("alertdialog");

    act(() => callSignals.emit({ kind: "ended", callId: "call-1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Missed call.");
  });
});

describe("outgoing calls", () => {
  it("rings the other person, then offers once they accept, signed", async () => {
    const fetchMock = backend();
    const { user } = renderCalls();
    await user.click(screen.getByRole("button", { name: "dial" }));

    expect(await screen.findByRole("status", { name: "Call with grace" })).toHaveTextContent("Calling…");
    expect(requestLog(fetchMock)).toContain("POST /api/v1/dm-calls/u2/invite");
    expect(requestLog(fetchMock)).not.toContain("POST /api/v1/dm-calls/call-1/signal"); // nothing is offered while it rings

    act(() => callSignals.emit({ kind: "accepted", callId: "call-1" }));

    await waitFor(() => expect(requestLog(fetchMock)).toContain("POST /api/v1/dm-calls/call-1/signal"));
    const call = fetchMock.mock.calls.find(([url]) => String(url).endsWith("/call-1/signal"))!;
    const body = JSON.parse(String(call[1]!.body)) as { signal_type: string; payload: { e2ee: { key_id: string; signature: string } } };
    expect(body.signal_type).toBe("offer");
    expect(body.payload.e2ee.key_id).toHaveLength(32);
    expect(body.payload.e2ee.signature.length).toBeGreaterThan(40);
    expect(screen.getByRole("status")).toHaveTextContent("Connecting…");
  });

  it("cancels with the hang-up button", async () => {
    const fetchMock = backend();
    const { user } = renderCalls();
    await user.click(screen.getByRole("button", { name: "dial" }));
    await user.click(await screen.findByRole("button", { name: "Cancel call" }));

    expect(requestLog(fetchMock)).toContain("POST /api/v1/dm-calls/call-1/end");
    await waitFor(() => expect(screen.queryByRole("status")).not.toBeInTheDocument());
  });

  it("says so when they decline, and lets the notice be dismissed", async () => {
    backend();
    const { user } = renderCalls();
    await user.click(screen.getByRole("button", { name: "dial" }));
    await screen.findByRole("status", { name: "Call with grace" });

    act(() => callSignals.emit({ kind: "rejected", callId: "call-1" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("grace declined.");
    await user.click(screen.getByRole("button", { name: "Dismiss" }));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("shows why a call could not be placed", async () => {
    backend({ "POST /api/v1/dm-calls/u2/invite": jsonResponse({ error_code: "validation.payload_malformed", message: "Cannot call this user" }, 400) });
    const { user } = renderCalls();
    await user.click(screen.getByRole("button", { name: "dial" }));
    expect(await screen.findByRole("alert")).toBeInTheDocument();
  });

  it("ignores signals for some other call", async () => {
    backend();
    const { user } = renderCalls();
    await user.click(screen.getByRole("button", { name: "dial" }));
    await screen.findByRole("status", { name: "Call with grace" });

    act(() => callSignals.emit({ kind: "ended", callId: "someone-elses" }));

    expect(screen.getByRole("status", { name: "Call with grace" })).toBeInTheDocument();
  });
});
