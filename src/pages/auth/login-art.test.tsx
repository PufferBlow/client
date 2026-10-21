import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import { AuthArt } from "../../components/auth/AuthArt";
import { resolveInstance } from "../../services/instance";
import { jsonResponse, routeFetch } from "../../test/helpers";
import { createTestQueryClient, renderWithProviders } from "../../test/render";
import { AuthLayout } from "../../layouts/AuthLayout";
import { LoginPage } from "./LoginPage";
import { MemoryRouter, Route, Routes } from "react-router";
import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const info = {
  server_id: "s1",
  server_name: "Deadlock Community",
  server_description: null,
  version: "0.9.2",
  avatar_url: null,
  banner_url: "/assets/banners/pb-banner-happy-violet.svg",
  members_count: 48210,
  online_members: 1904,
  is_private: false,
  max_message_length: null,
  max_total_attachment_size: null,
};

const instance = resolveInstance("chat.example");

describe("AuthArt", () => {
  it("is the brand until a handle points at an instance", () => {
    renderWithProviders(<AuthArt instance={null} info={null} />);
    expect(screen.getByText("A quiet room full of loud fish.")).toBeInTheDocument();
  });

  it("shows the instance's own name, counts and host once it has answered", () => {
    renderWithProviders(<AuthArt instance={instance} info={info} />);
    expect(screen.getByRole("heading", { name: "Deadlock Community" })).toBeInTheDocument();
    expect(screen.getByText("1,904")).toBeInTheDocument();
    expect(screen.getByText(/48,210 members/)).toBeInTheDocument();
    expect(screen.getByText(/hosted on chat\.example/)).toBeInTheDocument();
    expect(screen.getByLabelText("Deadlock Community on chat.example").getAttribute("style")).toContain("https://chat.example/assets/banners/pb-banner-happy-violet.svg");
  });

  it("falls back to the instance's identity banner when it has no picture", () => {
    renderWithProviders(<AuthArt instance={instance} info={{ ...info, banner_url: null }} />);
    expect(screen.getByLabelText("Deadlock Community on chat.example").getAttribute("style")).toContain("background");
  });
});

function renderInLayout() {
  const user = userEvent.setup();
  render(
    <QueryClientProvider client={createTestQueryClient()}>
      <MemoryRouter initialEntries={["/login"]}>
        <Routes>
          <Route element={<AuthLayout />}>
            <Route path="/login" element={<LoginPage />} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
  return user;
}

describe("the login screen", () => {
  it("asks the instance in the handle about itself, says Found, and puts it on the art", async () => {
    const fetchMock = routeFetch({ "GET /api/v1/system/server-info": { server_info: info } });
    const user = renderInLayout();

    await user.type(screen.getByLabelText("Handle"), "lonelyfrog@chat.example");

    expect(await screen.findByText("Found", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: "Deadlock Community" })).toBeInTheDocument();
    expect(new URL(String(fetchMock.mock.calls[0]![0])).origin).toBe("https://chat.example");
  });

  it("says Not found when the instance does not answer", async () => {
    routeFetch({ "GET /api/v1/system/server-info": jsonResponse({ detail: "no" }, 404) });
    const user = renderInLayout();

    await user.type(screen.getByLabelText("Handle"), "lonelyfrog@nowhere.example");

    expect(await screen.findByText("Not found", {}, { timeout: 3000 })).toBeInTheDocument();
    expect(screen.getByText("A quiet room full of loud fish.")).toBeInTheDocument();
  });

  it("does not ask anything until typing pauses, nor for a handle with no instance", async () => {
    const fetchMock = routeFetch({ "GET /api/v1/system/server-info": { server_info: info } });
    const user = renderInLayout();

    await user.type(screen.getByLabelText("Handle"), "lonelyfrog");
    await new Promise((resolve) => setTimeout(resolve, 800));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.queryByText("Found")).not.toBeInTheDocument();
  });

  it("offers a passkey button that is off until instances support it", async () => {
    renderInLayout();
    const passkey = await screen.findByRole("button", { name: /Use a passkey/ });
    expect(passkey).toBeDisabled();
    await waitFor(() => expect(passkey).toHaveAttribute("title", expect.stringContaining("not available")));
  });
});
