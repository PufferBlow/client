import { describe, expect, it } from "vitest";
import { identity, type RoleBadgeData } from "@pufferblow/spines";
import { rolesOf, shownBadge } from "./roles";

const community = (glyph: string): RoleBadgeData => ({ tier: "community", tone: "violet", glyph });
const staff = (glyph: string): RoleBadgeData => ({ tier: "staff", tone: "sky", glyph });
const system: RoleBadgeData = { tier: "system", tone: "grey", glyph: "globe" };

describe("the badge shown beside a name", () => {
  it("is nothing for an ordinary member or someone without roles", () => {
    expect(shownBadge(null)).toBeUndefined();
    expect(shownBadge({ roles_ids: [] })).toBeUndefined();
    expect(shownBadge({ roles_ids: ["member"] })).toBeUndefined();
    expect(shownBadge({ roles_ids: ["user"] })).toBeUndefined();
  });

  it("is the built-in owner or moderator badge even when the instance sent none (older instances)", () => {
    expect(shownBadge({ roles_ids: ["owner"] })?.badge).toEqual({ tier: "staff", tone: "brass", glyph: "crown" });
    expect(shownBadge({ roles_ids: ["moderator"] })?.badge.glyph).toBe("shield");
  });

  it("is the highest role that has a badge: staff over community over system, and the built-ins lead their tier", () => {
    const resolved = (...roles: Array<[string, RoleBadgeData | null]>) => ({
      roles_ids: roles.map(([id]) => id),
      resolved_roles: roles.map(([role_id, badge]) => ({ role_id, role_name: role_id, badge })),
    });
    expect(shownBadge(resolved(["guest", system], ["coach", community("target")], ["warden", staff("key")]))?.id).toBe("warden");
    expect(shownBadge(resolved(["guest", system], ["coach", community("target")]))?.id).toBe("coach");
    expect(shownBadge(resolved(["warden", staff("key")], ["moderator", staff("shield")], ["owner", staff("crown")]))?.id).toBe("owner");
  });

  it("skips roles that have no badge, even ones that come first", () => {
    const person = {
      roles_ids: ["plain", "coach"],
      resolved_roles: [
        { role_id: "plain", role_name: "Plain", badge: null },
        { role_id: "coach", role_name: "Coach", badge: community("target") },
      ],
    };
    expect(shownBadge(person)?.id).toBe("coach");
    expect(shownBadge({ roles_ids: ["plain"], resolved_roles: [{ role_id: "plain", role_name: "Plain" }] })).toBeUndefined();
  });
});

describe("all of a person's roles, as tags", () => {
  it("lists staff first, then community, then system, then the roles with no badge", () => {
    const roles = rolesOf({
      roles_ids: ["none", "guest", "coach", "owner", "artist"],
      resolved_roles: [
        { role_id: "none", role_name: "No badge" },
        { role_id: "guest", role_name: "Guest", badge: system },
        { role_id: "coach", role_name: "Coach", badge: community("target") },
        { role_id: "artist", role_name: "Artist", badge: community("brush") },
      ],
    });
    expect(roles.map((r) => r.id)).toEqual(["owner", "coach", "artist", "guest", "none"]);
  });

  it("uses the server's name for the role when it sent one, else tidies the id", () => {
    expect(rolesOf({ roles_ids: ["night-owl"] })[0]?.name).toBe("Night owl");
    expect(rolesOf({ roles_ids: ["x"], resolved_roles: [{ role_id: "x", role_name: "Spirit Haze" }] })[0]?.name).toBe("Spirit Haze");
  });

  it("gives a role without a badge its identity colour, the same every time", () => {
    const a = rolesOf({ roles_ids: ["spirit"] })[0];
    expect(a?.badge).toBeNull();
    expect(a?.colour).toBe(identity("role:spirit").hex);
    expect(rolesOf({ roles_ids: ["spirit"] })[0]?.colour).toBe(a?.colour);
  });
});
