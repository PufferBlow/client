import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { listMemberships, rememberActiveAccount } from "../../services/accounts";
import { persistSession, setActiveAccountId } from "../../services/auth";
import { resolveInstance, setStoredInstance } from "../../services/instance";
import { jsonResponse, requestLog, routeFetch } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { AddServerDialog } from "./AddServerDialog";

const home = resolveInstance("home.example");
const assign = vi.fn();

const info = (join_mode: string, extra: Record<string, unknown> = {}) => ({
  server_info: { server_id: "away.example:443", server_name: "Away Place", server_description: "A quiet corner", avatar_url: null, banner_url: null, members_count: 12, online_members: 3, is_private: false, version: "1", join_mode, ...extra },
});

const joined = { status: "joined", user: { user_id: "u1", username: "fedi_ada_ab12cd" }, auth_token: "away-token", refresh_token: "r-away", auth_token_expire_time: "2099-01-01T00:00:00Z", refresh_token_expire_time: "2099-02-01T00:00:00Z" };

beforeEach(async () => {
  localStorage.clear();
  sessionStorage.clear();
  document.cookie = "auth_token=; Max-Age=0; Path=/";
  vi.stubGlobal("location", { ...window.location, assign });
  setStoredInstance(home);
  setActiveAccountId(`ada@${home.raw}`);
  await persistSession({ auth_token: "home-token", refresh_token: "r-home", auth_token_expire_time: "2099-01-01T00:00:00Z" }, true);
  await rememberActiveAccount({ username: "ada" });
});
afterEach(() => {
  vi.unstubAllGlobals();
  assign.mockClear();
});

const typeAddress = async (user: ReturnType<typeof renderWithProviders>["user"], address = "away.example") => user.type(screen.getByLabelText("Server address"), address);

describe("the join popup", () => {
  it("shows what the server is before anything is done, and joins an open one with no form to fill", async () => {
    const fetchMock = routeFetch({
      "GET /api/v1/system/server-info": info("open"),
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user);

    expect(await screen.findByText("Away Place")).toBeInTheDocument();
    expect(screen.getByText("A quiet corner")).toBeInTheDocument();
    expect(screen.getByText(/12 members/)).toBeInTheDocument();
    expect(screen.getByText(/Open to everyone/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Invitation code")).not.toBeInTheDocument();
    // No account is made there: nothing asks for a password or a name.
    expect(screen.queryByLabelText(/password/i)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Join" }));
    await waitFor(() => expect(assign).toHaveBeenCalledWith("/dashboard/channels"));
    expect(listMemberships()).toHaveLength(1);
    // The assertion is addressed to the name the server uses for itself.
    const body = JSON.parse(String(fetchMock.mock.calls.find(([input]) => String(input).includes("/assertions"))![1]!.body));
    expect(body.audience).toBe("away.example:443");
  });

  it("asks a private server for its code, and sends it", async () => {
    const fetchMock = routeFetch({
      "GET /api/v1/system/server-info": info("invite"),
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse(joined),
      "POST /api/v1/users/joined-servers": { status_code: 201 },
    });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user);
    await screen.findByText(/Invite only/);

    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByText("Enter the invitation code you were given.")).toBeInTheDocument();
    expect(requestLog(fetchMock)).not.toContain("POST /api/v1/federation/join");

    await user.type(screen.getByLabelText("Invitation code"), "ABCD-EFGH-JKMN");
    await user.click(screen.getByRole("button", { name: "Join with code" }));
    await waitFor(() => expect(assign).toHaveBeenCalled());
    const body = JSON.parse(String(fetchMock.mock.calls.find(([input]) => String(input).endsWith("/federation/join"))![1]!.body));
    expect(body).toMatchObject({ assertion: "x.y", invite_code: "ABCD-EFGH-JKMN" });
  });

  it("shows a refused code in plain words", async () => {
    routeFetch({
      "GET /api/v1/system/server-info": info("invite"),
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse({ error_code: "join.invite_invalid", user_message: "That invitation code isn't valid. It may have expired or been used up." }, 403),
    });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user);
    await screen.findByText(/Invite only/);
    await user.type(screen.getByLabelText("Invitation code"), "WRONG");
    await user.click(screen.getByRole("button", { name: "Join with code" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("isn't valid");
    expect(assign).not.toHaveBeenCalled();
  });

  it("sends a request to a server that approves new people, and says it is waiting", async () => {
    routeFetch({
      "GET /api/v1/system/server-info": info("request"),
      "POST /api/v1/federation/assertions": { assertion: "x.y" },
      "POST /api/v1/federation/join": () => jsonResponse({ status: "pending", request_id: "r1" }, 202),
    });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user);
    await screen.findByText(/Asks to approve new people/);
    await user.type(screen.getByLabelText("Note for the moderators"), "Friend of linus");
    await user.click(screen.getByRole("button", { name: "Request to join" }));

    expect(await screen.findByRole("heading", { name: "Request sent" })).toBeInTheDocument();
    expect(listMemberships()[0]?.membership).toMatchObject({ status: "pending", requestId: "r1" });
    expect(assign).not.toHaveBeenCalled();
  });

  it("says when there is no server there, and will not try", async () => {
    routeFetch({ "GET /api/v1/system/server-info": jsonResponse({ detail: "nope" }, 404) });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user, "nowhere.example");
    expect(await screen.findByRole("alert")).toHaveTextContent("Couldn't find a Pufferblow server at nowhere.example");
    expect(screen.getByRole("button", { name: "Join" })).toBeDisabled();
  });

  it("knows your own server and one you have already joined", async () => {
    routeFetch({ "GET /api/v1/system/server-info": info("open", { server_id: "home.example:443" }) });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user, "home.example");
    expect(await screen.findByText("That is your own server.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Join" })).toBeDisabled();
  });

  it("points an expired home sign-in at the way back", async () => {
    routeFetch({
      "GET /api/v1/system/server-info": info("open"),
      "POST /api/v1/federation/assertions": jsonResponse({ error_code: "auth.invalid_token", message: "no" }, 401),
    });
    const { user } = renderWithProviders(<AddServerDialog onClose={() => undefined} />);
    await typeAddress(user);
    await screen.findByText("Away Place");
    await user.click(screen.getByRole("button", { name: "Join" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Your sign-in on your own server has expired");
  });
});
