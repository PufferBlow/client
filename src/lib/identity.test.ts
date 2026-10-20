import { describe, expect, it } from "vitest";
import { bannerCss, defaultAvatarUrl, EXPRESSIONS, fishUrl, identity, TONES, TONE_HEX } from "./identity";

describe("identity", () => {
  it("is the same for the same handle however it is written", () => {
    expect(identity("Vexa@Lanes.GG")).toEqual(identity("  vexa@lanes.gg "));
  });

  it("matches the design language's reference hash", () => {
    // Computed with the reference implementation (identity.js in the design language), so a change
    // to the hash, which would recolour everyone, fails here.
    expect(identity("x")).toMatchObject({ expression: "happy", tone: "violet", pattern: "burst" });
    expect(identity("vexa@lanes.gg")).toMatchObject({ expression: "default", tone: "sky", pattern: "ripple" });
  });

  it("only ever picks from the six tones, six faces and four patterns", () => {
    for (const handle of ["a", "b@c.d", "rina@mesh.garden", "ωλ", ""]) {
      const id = identity(handle);
      expect(TONES).toContain(id.tone);
      expect(EXPRESSIONS).toContain(id.expression);
      expect(id.hex).toBe(TONE_HEX[id.tone]);
    }
  });

  it("finds a fish file for every face in every tone", () => {
    for (const expression of EXPRESSIONS) for (const tone of TONES) expect(fishUrl(expression, tone)).toMatch(/\.svg/);
    expect(defaultAvatarUrl("vexa@lanes.gg")).toMatch(/default-sky/);
  });

  it("builds each banner pattern on the colour", () => {
    for (const pattern of ["ripple", "burst", "halftone", "crowd"] as const) expect(bannerCss("#a99cf2", pattern)).toContain("#a99cf2");
  });
});
