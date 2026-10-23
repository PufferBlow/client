import { beforeEach, describe, expect, it, vi } from "vitest";
import { screen, waitFor, within } from "@testing-library/react";
import { jsonResponse, routeFetch, signIn } from "../../test/helpers";
import { renderWithProviders } from "../../test/render";
import { stubXhrOverFetch } from "../../test/xhrOverFetch";
import { SettingsPage } from "./SettingsPage";

const me = {
  user_id: "me",
  username: "ada",
  about: "Hello there.",
  status: "online",
  accent_color: "#ffffff",
  avatar_url: "/assets/avatars/pb-avatar-happy-ink.svg",
  avatar_kind: "identicon",
  banner_kind: "default",
  origin_server: "localhost:7575",
  roles_ids: ["owner"],
  pronouns: null,
  custom_status: null,
  profile_settings: null,
};

beforeEach(() => {
  signIn("tok");
  stubXhrOverFetch();
});

const backend = (extra: Record<string, unknown> = {}, profile: Record<string, unknown> = {}) =>
  routeFetch({ "POST /api/v1/users/profile": { user_data: { ...me, ...profile } }, ...extra });

const renderProfile = () => renderWithProviders(<SettingsPage />, { route: "/settings/profile", path: "/settings/:section?" });

const bodiesOf = (fetchMock: ReturnType<typeof routeFetch>, method: string, path: string) =>
  fetchMock.mock.calls
    .filter(([input, init]) => (init?.method ?? "GET") === method && new URL(String(input)).pathname === path)
    .map(([, init]) => JSON.parse(String(init!.body)) as Record<string, unknown>);

const editor = async () => within(await screen.findByRole("region", { name: "Customize your profile" }));

describe("customising your profile", () => {
  it("shows your card beside the choices, as it is now", async () => {
    backend();
    renderProfile();
    const card = within(await screen.findByRole("article", { name: "ada's profile" }));
    expect(card.getByRole("heading", { name: "ada" })).toBeInTheDocument();
    expect(card.getByText("ada@localhost:7575")).toBeInTheDocument();
    expect(card.getByText("Hello there.")).toBeInTheDocument();
    expect(card.getByTitle("Instance owner")).toBeInTheDocument(); // the badges section is on by default
  });

  it("changes the card as you choose, before anything is saved", async () => {
    const fetchMock = backend();
    const { user } = renderProfile();
    const choices = await editor();

    await user.click(choices.getByRole("button", { name: "Two-tone" }));
    await user.type(choices.getByLabelText("Custom status"), "grinding to Phantom");
    await user.type(choices.getByLabelText("Pronouns"), "she/her");

    const card = within(screen.getByRole("article", { name: "ada's profile" }));
    expect(card.getByText("grinding to Phantom")).toBeInTheDocument();
    expect(card.getByText("she/her")).toBeInTheDocument();
    expect(screen.getByRole("article", { name: "ada's profile" }).getAttribute("style")).toContain("linear-gradient"); // two-tone
    expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")).toHaveLength(0);
  });

  it("saves only what changed: the text in one request, the settings in another", async () => {
    const fetchMock = backend({ "PUT /api/v1/users/profile": { status_code: 200 }, "PUT /api/v1/users/profile/appearance": { status_code: 200 } });
    const { user } = renderProfile();
    const choices = await editor();
    const save = choices.getByRole("button", { name: "Save profile" });
    expect(save).toBeDisabled();

    await user.click(choices.getByRole("button", { name: "Ring" }));
    await user.click(choices.getByRole("button", { name: "Colour: sky" }));
    await user.type(choices.getByLabelText("Pronouns"), "she/her");
    await user.click(save);

    await waitFor(() => expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")).toHaveLength(1));
    expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")[0]).toMatchObject({ profile_settings: { frame: "ring", tone: "sky" } });
    expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")[0]!.profile_settings).not.toHaveProperty("card_theme");
    const text = bodiesOf(fetchMock, "PUT", "/api/v1/users/profile")[0]!;
    expect(text).toMatchObject({ pronouns: "she/her" });
    expect(text).not.toHaveProperty("custom_status"); // the status was not touched
    expect(await choices.findByText("Profile saved.")).toBeInTheDocument();
  });

  it("starts from what is saved and can go back to the defaults", async () => {
    backend({}, { profile_settings: { frame: "spines", tone: "coral", card_theme: "tinted" }, pronouns: "they/them" });
    const { user } = renderProfile();
    const choices = await editor();
    expect(choices.getByRole("button", { name: "Spines" })).toHaveAttribute("aria-pressed", "true");
    expect(choices.getByLabelText("Pronouns")).toHaveValue("they/them");
    expect(choices.getByRole("button", { name: "Save profile" })).toBeDisabled();

    await user.click(choices.getByRole("button", { name: "Reset" }));

    expect(choices.getByRole("button", { name: "None" })).toHaveAttribute("aria-pressed", "true");
    expect(choices.getByLabelText("Pronouns")).toHaveValue("");
    expect(choices.getByRole("button", { name: "Save profile" })).toBeEnabled(); // it differs from what is saved
  });

  it("sends a choice back to the one derived from the handle as null", async () => {
    const fetchMock = backend({ "PUT /api/v1/users/profile/appearance": { status_code: 200 } }, { profile_settings: { tone: "coral" } });
    const { user } = renderProfile();
    const choices = await editor();

    await user.click(choices.getByRole("button", { name: "Reset" }));
    await user.click(choices.getByRole("button", { name: "Save profile" }));

    await waitFor(() => expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")).toHaveLength(1));
    expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")[0]!.profile_settings).toEqual({ tone: null });
  });

  it("Surprise me picks a new look without saving it", async () => {
    vi.spyOn(Math, "random").mockReturnValue(0.99);
    const fetchMock = backend();
    const { user } = renderProfile();
    const choices = await editor();

    await user.click(choices.getByRole("button", { name: /Surprise me/ }));

    expect(choices.getByRole("button", { name: "Bubbles" })).toHaveAttribute("aria-pressed", "true");
    expect(choices.getByRole("button", { name: "Save profile" })).toBeEnabled();
    expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")).toHaveLength(0);
  });

  it("says why when the instance refuses", async () => {
    backend({
      "PUT /api/v1/users/profile/appearance": jsonResponse({ error_code: "validation.field_range", message: "tone must be one of the six colours", details: { field: "tone" } }, 400),
    });
    const { user } = renderProfile();
    const choices = await editor();

    await user.click(choices.getByRole("button", { name: "Ring" }));
    await user.click(choices.getByRole("button", { name: "Save profile" }));

    expect(await choices.findByRole("alert")).toBeInTheDocument();
  });

  it("offers the second colour only for a two-tone card or banner", async () => {
    backend();
    const { user } = renderProfile();
    const choices = await editor();
    expect(choices.queryByRole("group", { name: "Second colour" })).not.toBeInTheDocument();

    await user.click(choices.getByRole("button", { name: "Two-tone" }));

    expect(choices.getByRole("group", { name: "Second colour" })).toBeInTheDocument();
  });

  it("leaves the face and the banner to an uploaded picture", async () => {
    backend({}, { avatar_kind: "image", banner_kind: "image", avatar_url: "/storage/abc" });
    renderProfile();
    const choices = await editor();
    expect(choices.queryByRole("group", { name: "Face" })).not.toBeInTheDocument();
    expect(choices.queryByRole("group", { name: "Banner" })).not.toBeInTheDocument();
  });

  describe("uploading pictures", () => {
    it("shows an uploaded avatar at once, even while the instance still answers with the old profile", async () => {
      // The profile route keeps returning the old profile, as an instance does while its cache is stale.
      const fetchMock = backend({ "POST /api/v1/users/profile/avatar": { status_code: 201, avatar_url: "/storage/new-avatar" } });
      const { user } = renderProfile();
      const choices = await editor();

      await user.upload(choices.getByLabelText("Avatar file"), new File([new Uint8Array(512)], "me.gif", { type: "image/gif" }));

      expect(await choices.findByRole("img", { name: "Your avatar" })).toHaveAttribute("src", expect.stringContaining("/storage/new-avatar"));
      expect(fetchMock.mock.calls.some(([input, init]) => init?.method === "POST" && new URL(String(input)).pathname === "/api/v1/users/profile/avatar")).toBe(true);
      expect(choices.getByRole("button", { name: "Use the default" })).toBeInTheDocument();
    });

    it("shows an uploaded banner at once and can go back to the default", async () => {
      const fetchMock = backend({
        "POST /api/v1/users/profile/banner": { status_code: 201, banner_url: "/storage/new-banner" },
        "PUT /api/v1/users/profile/appearance": { status_code: 200 },
      });
      const { user } = renderProfile();
      const choices = await editor();

      await user.upload(choices.getByLabelText("Banner file"), new File([new Uint8Array(512)], "wide.png", { type: "image/png" }));
      expect(await choices.findByRole("img", { name: "Your banner" })).toBeInTheDocument();

      await user.click(choices.getByRole("button", { name: "Use the default" }));
      await waitFor(() => expect(bodiesOf(fetchMock, "PUT", "/api/v1/users/profile/appearance")).toEqual([expect.objectContaining({ banner_kind: "default" })]));
      await waitFor(() => expect(choices.queryByRole("img", { name: "Your banner" })).not.toBeInTheDocument());
    });
  });
});
