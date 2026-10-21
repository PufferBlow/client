import { describe, expect, it } from "vitest";
import { identity } from "../../lib/identity";
import { shownRole } from "./roles";

describe("the role shown beside a name", () => {
  it("is nothing for an ordinary member or someone without roles", () => {
    expect(shownRole(null)).toBeUndefined();
    expect(shownRole({ roles_ids: [] })).toBeUndefined();
    expect(shownRole({ roles_ids: ["member"] })).toBeUndefined();
  });

  it("is the highest of owner, admin and moderator, over any other role", () => {
    expect(shownRole({ roles_ids: ["member", "spirit", "admin"] })?.id).toBe("admin");
    expect(shownRole({ roles_ids: ["moderator", "owner"] })?.id).toBe("owner");
    expect(shownRole({ roles_ids: ["member", "spirit", "weapon"] })?.id).toBe("spirit");
  });

  it("uses the server's name for the role when it sent one, else tidies the id", () => {
    expect(shownRole({ roles_ids: ["night-owl"] })?.name).toBe("Night owl");
    expect(shownRole({ roles_ids: ["x"], resolved_roles: [{ role_id: "x", role_name: "Spirit Haze" }] })?.name).toBe("Spirit Haze");
  });

  it("colours each role with its identity colour, the same every time", () => {
    const a = shownRole({ roles_ids: ["spirit"] });
    expect(a?.colour).toBe(identity("role:spirit").hex);
    expect(shownRole({ roles_ids: ["spirit"] })?.colour).toBe(a?.colour);
  });
});
