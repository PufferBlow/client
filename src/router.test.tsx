import { beforeEach, describe, expect, it } from "vitest";
import { router } from "./router";
import { signIn } from "./test/helpers";

/** Navigate the real router (loaders run, nothing renders) and report where it ended up. */
async function visit(path: string) {
  await router.navigate(path);
  const { pathname, search } = router.state.location;
  return pathname + search;
}

const leafPath = () => router.state.matches.at(-1)?.route.path;

beforeEach(async () => {
  // Start every test from a neutral, public location.
  await router.navigate("/login");
});

describe("route guard", () => {
  it.each(["/dashboard", "/dashboard/friends", "/dashboard/channels/abc", "/settings", "/settings/profile", "/control-panel"])(
    "sends a signed-out visitor from %s to login",
    async (path) => {
      const landed = await visit(path);
      expect(landed.startsWith("/login?redirect=")).toBe(true);
      expect(decodeURIComponent(landed.split("redirect=")[1]!)).toBe(path);
    },
  );

  it("keeps the query string in the redirect target", async () => {
    const landed = await visit("/settings/profile?tab=1");
    expect(decodeURIComponent(landed.split("redirect=")[1]!)).toBe("/settings/profile?tab=1");
  });

  it("can't carry a #fragment: loaders only see the request URL, which never includes one", async () => {
    const landed = await visit("/settings/profile#top");
    expect(decodeURIComponent(landed.split("redirect=")[1]!)).toBe("/settings/profile");
  });

  it("lets a signed-in user through", async () => {
    signIn();
    expect(await visit("/dashboard/friends")).toBe("/dashboard/friends");
    expect(await visit("/settings/security")).toBe("/settings/security");
  });

  it("does not guard the auth screens", async () => {
    expect(await visit("/login")).toBe("/login");
    expect(await visit("/signup")).toBe("/signup");
  });
});

describe("root route", () => {
  it("shows the landing page to a signed-out visitor", async () => {
    expect(await visit("/")).toBe("/");
  });

  it("sends a signed-in user to the dashboard", async () => {
    signIn();
    expect(await visit("/")).toBe("/dashboard");
  });

  it("resumes the last route a signed-in user was on", async () => {
    signIn();
    localStorage.setItem("pb_last_route", "/settings");
    expect(await visit("/")).toBe("/settings");
  });

  it("ignores a remembered route that isn't allowed", async () => {
    signIn();
    localStorage.setItem("pb_last_route", "/somewhere/else");
    expect(await visit("/")).toBe("/dashboard");
  });
});

describe("unknown URLs", () => {
  it("fall through to the catch-all route", async () => {
    await visit("/definitely/not/a/page");
    expect(leafPath()).toBe("*");
  });

  it("don't need a session to show the 404", async () => {
    expect(await visit("/nope")).toBe("/nope");
  });
});
