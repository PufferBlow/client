import { describe, expect, it } from "vitest";
import type { UserProfile } from "../users/types";
import { groupByRole } from "./groups";

const person = (username: string, status: string, roles: { id: string; name: string; badge?: unknown }[] = []): UserProfile =>
  ({
    user_id: username,
    username,
    status,
    about: null,
    accent_color: null,
    avatar_url: null,
    origin_server: "x",
    roles_ids: roles.map((r) => r.id),
    resolved_roles: roles.map((r) => ({ role_id: r.id, role_name: r.name, is_system: false, badge: r.badge ?? null })),
  }) as unknown as UserProfile;

const owner = { id: "owner", name: "Owner" };
const admin = { id: "admin", name: "Admin" };
const moderator = { id: "moderator", name: "Moderator" };
const coach = { id: "coach", name: "Coach", badge: { tier: "community", tone: "violet", glyph: "target" } };
const helper = { id: "helper", name: "Helper" };
const user = { id: "user", name: "Regular User" };

describe("groupByRole", () => {
  it("puts people under their highest role, highest group first, and everyone else under Members", () => {
    const groups = groupByRole([
      person("zed", "online"),
      person("mod", "online", [moderator, user]),
      person("boss", "online", [owner, admin]),
      person("adm", "online", [admin]),
      person("coachy", "online", [coach]),
      person("plain", "offline", [user]),
    ]);
    expect(groups.map((g) => [g.label, g.members.map((m) => m.username)])).toEqual([
      ["Owner", ["boss"]],
      ["Admin", ["adm"]],
      ["Moderator", ["mod"]],
      ["Coach", ["coachy"]],
      ["Members", ["zed", "plain"]],
    ]);
  });

  it("lists the people who are online first in a group, each half by name", () => {
    const [group] = groupByRole([
      person("dora", "offline", [moderator]),
      person("cy", "online", [moderator]),
      person("abe", "offline", [moderator]),
      person("bo", "idle", [moderator]),
    ]);
    expect(group!.members.map((m) => m.username)).toEqual(["bo", "cy", "abe", "dora"]);
  });

  it("puts a role with a badge ahead of one without, and keeps one person in one group", () => {
    const groups = groupByRole([person("h", "online", [helper]), person("c", "online", [coach, helper])]);
    expect(groups.map((g) => g.label)).toEqual(["Coach", "Helper"]);
    expect(groups.flatMap((g) => g.members).map((m) => m.username).sort()).toEqual(["c", "h"]);
  });

  it("gives no groups for nobody", () => {
    expect(groupByRole([])).toEqual([]);
  });
});
