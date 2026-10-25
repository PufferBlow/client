import { beforeEach, describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import { jsonResponse, requestLog, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { ControlPanelPage } from "./ControlPanelPage";
import { type FederationMode, type Peer, type PeerStatus, parseHostList, peerHost } from "../../features/federation/peers";

beforeEach(() => signIn("tok"));

const owner = {
  user_id: "me",
  username: "ada",
  about: null,
  status: "online",
  accent_color: null,
  avatar_url: null,
  origin_server: "localhost:7575",
  roles_ids: ["owner"],
};

const STATUS_DEFAULTS = {
  federating: { media: true, voice: true, discover: true },
  limited: { media: false, voice: true, discover: false },
  pending: { media: false, voice: false, discover: false },
  blocked: { media: false, voice: false, discover: false },
};

const peer = (host: string, status: PeerStatus, over: Partial<Peer> = {}): Peer => ({
  host,
  status,
  policy: STATUS_DEFAULTS[status],
  software: null,
  version: null,
  users: null,
  follows: 0,
  last_activity: null,
  last_delivery_at: null,
  last_delivery_ok: null,
  latency_ms: null,
  ...over,
});

/** A federation backend that keeps its peers, so a change on screen is answered by what the server would now say. */
function backend(initial: Peer[] = [peer("mesh.garden", "federating", { follows: 2, software: "pufferblow", version: "1.2", users: 40, latency_ms: 88 }), peer("kiln.social", "pending"), peer("noise.example", "blocked")]) {
  const state = { mode: "open" as FederationMode, peers: initial };
  const counts = () => Object.fromEntries((["federating", "pending", "limited", "blocked"] as const).map((s) => [s, state.peers.filter((p) => p.status === s).length]));
  const hostOf = (url: URL) => decodeURIComponent(url.pathname.split("/")[5]!);
  const find = (host: string) => state.peers.find((p) => p.host === host);
  const bodyOf = (init: RequestInit) => JSON.parse(String(init.body ?? "{}")) as Record<string, unknown>;

  const fetchMock = routeFetch({
    "POST /api/v1/users/profile": { user_data: owner },
    "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "Switchyard", version: "0.9.2", avatar_url: null, banner_url: null } },
    "GET /api/v1/channels/read-history": { unread_counts: {} },
    "POST /api/v1/channels/list/": { channels: [] },
    "GET /api/v1/users/list": { users: [owner] },
    "GET /api/v1/federation/peers": () => jsonResponse({ mode: state.mode, modes: ["open", "allowlist", "closed"], counts: counts(), peers: state.peers }),
    "PUT /api/v1/federation/mode": (_url: URL, init: RequestInit) => {
      state.mode = bodyOf(init).mode as FederationMode;
      return jsonResponse({ mode: state.mode });
    },
    "POST /api/v1/federation/peers": (_url: URL, init: RequestInit) => {
      const { host, status } = bodyOf(init) as { host: string; status: PeerStatus };
      if (find(host)) return jsonResponse({ error_code: "resource.conflict", message: `${host} is already a peer.` }, 409);
      state.peers = [...state.peers, peer(host, status)];
      return jsonResponse({ peer: find(host) }, 201);
    },
    "PUT /api/v1/federation/peers/mesh.garden/status": (url: URL, init: RequestInit) => setStatus(hostOf(url), init),
    "PUT /api/v1/federation/peers/kiln.social/status": (url: URL, init: RequestInit) => setStatus(hostOf(url), init),
    "PUT /api/v1/federation/peers/noise.example/status": (url: URL, init: RequestInit) => setStatus(hostOf(url), init),
    "PUT /api/v1/federation/peers/mesh.garden/policy": (url: URL, init: RequestInit) => {
      const target = find(hostOf(url))!;
      target.policy = { ...target.policy, ...(bodyOf(init).policy as object) };
      return jsonResponse({ peer: target });
    },
    "DELETE /api/v1/federation/peers/mesh.garden": () => {
      state.peers = state.peers.filter((p) => p.host !== "mesh.garden");
      return jsonResponse({ removed: true });
    },
    "POST /api/v1/federation/peers/mesh.garden/refresh": () => jsonResponse({ found: true, peer: find("mesh.garden") }),
    "POST /api/v1/federation/peers/import": (_url: URL, init: RequestInit) => {
      const hosts = bodyOf(init).hosts as string[];
      const added = hosts.filter((h) => /^[a-z.]+\.[a-z]+$/.test(h) && !find(h));
      state.peers = [...state.peers, ...added.map((h) => peer(h, "blocked"))];
      return jsonResponse({ added, skipped: hosts.filter((h) => find(h) && !added.includes(h)), invalid: hosts.filter((h) => !/^[a-z.]+\.[a-z]+$/.test(h)) });
    },
  });

  function setStatus(host: string, init: RequestInit) {
    const target = find(host)!;
    target.status = bodyOf(init).status as PeerStatus;
    target.policy = STATUS_DEFAULTS[target.status];
    return jsonResponse({ peer: target });
  }

  return { state, fetchMock };
}

const renderPanel = (section: string) => renderWithProviders(<ControlPanelPage />, { route: `/control-panel/${section}`, path: "/control-panel/:section?" });
const peersRegion = async () => within(await screen.findByRole("region", { name: "Peers" }));
const details = () => within(screen.getByRole("complementary", { name: "Peer details" }));

describe("the Peers page", () => {
  it("counts peers by status from the server", async () => {
    backend();
    renderPanel("peers");
    const section = await peersRegion();

    expect(await section.findByRole("button", { name: "Federating: 1" })).toBeInTheDocument();
    for (const status of ["Pending", "Blocked"]) expect(section.getByRole("button", { name: `${status}: 1` })).toBeInTheDocument();
    expect(section.getByRole("button", { name: "Limited: 0" })).toBeInTheDocument();
  });

  it("lists peers and shows the selected one's details, with what it said about itself", async () => {
    backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();

    await user.click(await section.findByRole("button", { name: /mesh\.garden/ }));

    expect(details().getByText("pufferblow 1.2 · 40 users")).toBeInTheDocument();
    expect(details().getByText("88 ms")).toBeInTheDocument();
    expect(details().getByRole("switch", { name: "Media" })).toHaveAttribute("aria-checked", "true");
  });

  it("filters by status and says when nothing has it", async () => {
    backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();
    await section.findByText("mesh.garden");

    await user.click(section.getByRole("button", { name: "Pending: 1" }));
    expect(section.queryByText("mesh.garden")).not.toBeInTheDocument();
    expect(section.getByText("kiln.social")).toBeInTheDocument();

    await user.click(section.getByRole("button", { name: "Pending: 1" }));
    await user.click(section.getByRole("button", { name: "Limited: 0" }));
    expect(section.getByText("Nothing is limited")).toBeInTheDocument();
  });

  it("changes the federation mode on the server", async () => {
    const { state } = backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();

    const modes = within(await section.findByRole("group", { name: "Federation mode" }));
    expect(modes.getByRole("button", { name: "Open" })).toHaveAttribute("aria-pressed", "true");
    await user.click(modes.getByRole("button", { name: "Allowlist" }));

    expect(await modes.findByRole("button", { name: "Allowlist", pressed: true })).toBeInTheDocument();
    expect(state.mode).toBe("allowlist");
    expect(section.getByText(/Only instances you approve/)).toBeInTheDocument();
  });

  it("blocks a peer and shows the switches locked", async () => {
    const { state } = backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();
    await user.click(await section.findByRole("button", { name: /mesh\.garden/ }));

    await user.click(details().getByRole("button", { name: "Block" }));

    expect(await section.findByRole("button", { name: "Blocked: 2" })).toBeInTheDocument();
    expect(state.peers.find((p) => p.host === "mesh.garden")!.status).toBe("blocked");
    expect(details().getByRole("switch", { name: "Media" })).toBeDisabled();
    expect(details().queryByRole("button", { name: "Block" })).not.toBeInTheDocument();
    expect(details().getByRole("button", { name: "Accept" })).toBeInTheDocument();
  });

  it("limits a peer, then flips one switch by hand", async () => {
    const { state } = backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();
    await user.click(await section.findByRole("button", { name: /mesh\.garden/ }));

    await user.click(details().getByRole("button", { name: "Limit" }));
    await section.findByRole("button", { name: "Limited: 1" });
    expect(details().getByRole("switch", { name: "Media" })).toHaveAttribute("aria-checked", "false");

    await user.click(details().getByRole("switch", { name: "Media" }));
    expect(await details().findByRole("switch", { name: "Media", checked: true })).toBeInTheDocument();
    expect(state.peers.find((p) => p.host === "mesh.garden")!.policy.media).toBe(true);
  });

  it("accepts a pending peer, checks one now, and removes one", async () => {
    const { state, fetchMock } = backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();

    await user.click(await section.findByRole("button", { name: /kiln\.social/ }));
    await user.click(details().getByRole("button", { name: "Accept" }));
    await section.findByRole("button", { name: "Federating: 2" });
    expect(state.peers.find((p) => p.host === "kiln.social")!.status).toBe("federating");

    await user.click(section.getByRole("button", { name: /mesh\.garden/ }));
    await user.click(details().getByRole("button", { name: "Check now" }));
    await user.click(details().getByRole("button", { name: "Remove" }));
    await section.findByRole("button", { name: "Federating: 1" });
    expect(requestLog(fetchMock)).toEqual(expect.arrayContaining(["POST /api/v1/federation/peers/mesh.garden/refresh", "DELETE /api/v1/federation/peers/mesh.garden"]));
  });

  it("adds a peer by hand, and shows the server's reason when it is already one", async () => {
    const { state } = backend();
    const { user } = renderPanel("peers");
    const section = await peersRegion();

    await user.type(await section.findByLabelText("Instance to add"), "fresh.example");
    await user.click(section.getByRole("button", { name: "Add peer" }));
    await section.findByRole("button", { name: "Federating: 2" });
    expect(state.peers.some((p) => p.host === "fresh.example")).toBe(true);

    await user.type(section.getByLabelText("Instance to add"), "fresh.example");
    await user.click(section.getByRole("button", { name: "Add peer" }));
    expect(await section.findByRole("alert")).toHaveTextContent(/already a peer/);
  });

  it("explains an instance with no peers", async () => {
    backend([]);
    renderPanel("peers");
    expect(await screen.findByText("No peers yet")).toBeInTheDocument();
  });

  it("shows an error with retry when the peers cannot be read", async () => {
    routeFetch({
      "POST /api/v1/users/profile": { user_data: owner },
      "GET /api/v1/system/server-info": { server_info: { server_id: "x", server_name: "S", version: "1", avatar_url: null, banner_url: null } },
      "GET /api/v1/channels/read-history": { unread_counts: {} },
      "POST /api/v1/channels/list/": { channels: [] },
      "GET /api/v1/users/list": { users: [owner] },
      "GET /api/v1/federation/peers": jsonResponse({ error_code: "auth.forbidden", message: "Admins only." }, 403),
    });
    renderPanel("peers");
    expect(await screen.findByText("Couldn't load peers")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /try again|retry/i })).toBeInTheDocument();
  });
});

describe("the Blocklist page", () => {
  it("lists blocked instances and lets one back in as Pending", async () => {
    const { state } = backend();
    const { user } = renderPanel("blocklist");

    const section = within(await screen.findByRole("region", { name: "Blocked instances" }));
    expect(await section.findByText("noise.example")).toBeInTheDocument();
    expect(section.queryByText("mesh.garden")).not.toBeInTheDocument();

    await user.click(section.getByRole("button", { name: "Unblock noise.example" }));

    expect(await section.findByText("Nobody is blocked")).toBeInTheDocument();
    expect(state.peers.find((p) => p.host === "noise.example")!.status).toBe("pending");
  });

  it("blocks a host that is new, and one that is already a peer", async () => {
    const { state } = backend();
    const { user } = renderPanel("blocklist");
    const section = within(await screen.findByRole("region", { name: "Blocked instances" }));

    await user.type(await section.findByLabelText("Instance to block"), "spam.example");
    await user.click(section.getByRole("button", { name: "Block" }));
    expect(await section.findByText("spam.example")).toBeInTheDocument();

    await user.type(section.getByLabelText("Instance to block"), "mesh.garden");
    await user.click(section.getByRole("button", { name: "Block" }));
    expect(await section.findByText("mesh.garden")).toBeInTheDocument();
    expect(state.peers.find((p) => p.host === "mesh.garden")!.status).toBe("blocked");
  });

  it("switches an existing peer to blocked when it is typed as a URL", async () => {
    const { state } = backend();
    const { user } = renderPanel("blocklist");
    const section = within(await screen.findByRole("region", { name: "Blocked instances" }));

    await user.type(await section.findByLabelText("Instance to block"), "HTTPS://Mesh.Garden/about");
    await user.click(section.getByRole("button", { name: "Block" }));
    expect(await section.findByText("mesh.garden")).toBeInTheDocument();
    expect(section.queryByRole("alert")).not.toBeInTheDocument();
    expect(state.peers.find((p) => p.host === "mesh.garden")!.status).toBe("blocked");
  });

  it("imports a list and reports what was added, skipped and not valid", async () => {
    const { state } = backend();
    const { user } = renderPanel("blocklist");
    const aside = within(await screen.findByRole("complementary", { name: "Import a list" }));

    await user.type(aside.getByLabelText("Hosts to block"), "a.example, b.example noise.example{Enter}bad");
    expect(aside.getByText(/4 hosts to block/)).toBeInTheDocument();
    await user.click(aside.getByRole("button", { name: "Import" }));

    expect(await aside.findByRole("status")).toHaveTextContent(/Blocked 2, skipped 1 already known, 1 not valid \(bad\)/);
    expect(state.peers.filter((p) => p.status === "blocked").map((p) => p.host)).toEqual(expect.arrayContaining(["a.example", "b.example"]));
  });
});

describe("peerHost", () => {
  it("reduces a URL or a capitalised host to the bare host", () => {
    expect(peerHost(" https://User@Mesh.Garden:8443/a?b#c ")).toBe("mesh.garden:8443");
    expect(peerHost("noise.example")).toBe("noise.example");
  });
});

describe("parseHostList", () => {
  it("splits on lines, commas and spaces, and drops comments and blanks", () => {
    expect(parseHostList("a.example\n\n b.example, c.example\n#d.example\ne.example")).toEqual(["a.example", "b.example", "c.example", "e.example"]);
  });
});
