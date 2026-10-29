import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen } from "@testing-library/react";
import { jsonResponse, mockFetch } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { SignupPage } from "./SignupPage";

let mode: "open" | "invite" | "request" = "invite";
vi.mock("../../features/instance/useHandleInstance", () => ({
  useHandleInstance: () => ({ instance: null, preview: { server_id: "x", server_name: "X", join_mode: mode }, probe: "found" }),
}));

const field = (name: RegExp | string) => screen.getByLabelText(name);
const tokens = { auth_token: "a", refresh_token: "r", auth_token_expire_time: "2099-01-01T00:00:00Z", refresh_token_expire_time: "2099-02-01T00:00:00Z" };

async function fill(user: ReturnType<typeof renderWithProviders>["user"]) {
  await user.type(field("Handle"), "ada@localhost:7575");
  await user.type(field("Password"), "longenough1");
  await user.type(field("Confirm password"), "longenough1");
}

beforeEach(() => {
  mode = "invite";
});

describe("signing up on a server that decides who comes in", () => {
  it("asks for the invitation code of an invite-only server and does not call it without one", async () => {
    const fetchMock = mockFetch();
    const { user } = renderWithProviders(<SignupPage />, { route: "/signup" });
    await fill(user);
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText("This server is invite-only. Enter your invitation code.")).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("sends the code with the sign-up", async () => {
    const fetchMock = mockFetch(jsonResponse(tokens, 201));
    const { user } = renderWithProviders(<SignupPage />, { route: "/signup" });
    await fill(user);
    await user.type(field("Invitation code"), "ABCD-EFGH-JKMN");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    await screen.findByTestId("elsewhere");
    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ username: "ada", password: "longenough1", invite_code: "ABCD-EFGH-JKMN" });
  });

  it("puts a refused code on the code field", async () => {
    mockFetch(jsonResponse({ error_code: "join.invite_invalid", user_message: "That invitation code isn't valid. It may have expired or been used up." }, 403));
    const { user } = renderWithProviders(<SignupPage />, { route: "/signup" });
    await fill(user);
    await user.type(field("Invitation code"), "WRONG");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByText(/isn't valid/)).toBeInTheDocument();
    expect(field("Invitation code")).toBeInvalid();
  });

  it("on a server that approves new people, offers a note and says the request was sent instead of signing in", async () => {
    mode = "request";
    mockFetch(jsonResponse({ status: "pending", message: "Your request to join was sent. You can sign in once a moderator approves it." }, 202));
    const { user } = renderWithProviders(<SignupPage />, { route: "/signup" });
    await fill(user);
    await user.type(field(/Note for the moderators/), "I know alice");
    await user.click(screen.getByRole("button", { name: /create account/i }));

    expect(await screen.findByRole("heading", { name: "Request sent" })).toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("a moderator approves it");
    expect(screen.queryByTestId("elsewhere")).not.toBeInTheDocument();
  });

  it("asks for nothing extra on an open server", async () => {
    mode = "open";
    renderWithProviders(<SignupPage />, { route: "/signup" });
    expect(screen.queryByLabelText(/Invitation code/)).not.toBeInTheDocument();
  });
});
