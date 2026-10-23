import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { RoleBadge } from "../components/ui/RoleBadge";
import { BADGE_GLYPHS, BADGE_PALETTE, BADGE_SHAPES, DEFAULT_BADGES, ROLE_PRESETS, canModerate, drawBadge, sameBadge } from "./roleBadges";

describe("drawing a badge", () => {
  it("uses the tier's shape, the tone's colour and an ink glyph", () => {
    const staff = drawBadge({ tier: "staff", tone: "brass", glyph: "crown" }, 16);
    expect(staff.shape).toBe(BADGE_SHAPES.staff);
    expect(staff.fill).toBe(BADGE_PALETTE.brass);
    expect(staff.ink).toBe("#0a0a0a");
    expect(staff.glyph).toBe(BADGE_GLYPHS.crown);
    expect(drawBadge({ tier: "community", tone: "sky", glyph: "film" }, 16).shape).toBe(BADGE_SHAPES.community);
    expect(drawBadge({ tier: "system", tone: "grey", glyph: "globe" }, 16).shape).toBe(BADGE_SHAPES.system);
  });

  it("scales the glyph by tier and thickens its stroke at small sizes", () => {
    const at = (size: number) => drawBadge({ tier: "community", tone: "sky", glyph: "film" }, size);
    expect(at(16).transform).toBe("translate(7.12 7.12) scale(0.74)");
    expect(drawBadge({ tier: "staff", tone: "sky", glyph: "film" }, 16).transform).toBe("translate(8.80 8.80) scale(0.6)");
    expect(drawBadge({ tier: "system", tone: "sky", glyph: "film" }, 16).transform).toBe("translate(7.60 7.60) scale(0.7)");
    // The same on-screen thickness at 16 as the design's 1.55 px, so in glyph units the thinner sizes get the larger numbers.
    expect(at(16).strokeWidth).toBeCloseTo((1.55 * 32) / (16 * 0.74), 2);
    expect(at(16).strokeWidth).toBeGreaterThan(at(64).strokeWidth);
  });

  it("draws an unknown glyph as an empty shape and an unknown tier as community, never failing", () => {
    const odd = drawBadge({ tier: "weird" as never, tone: "nope" as never, glyph: "???" }, 20);
    expect(odd.glyph).toBeNull();
    expect(odd.shape).toBe(BADGE_SHAPES.community);
    expect(odd.fill).toBe(BADGE_PALETTE.grey);
  });

  it("knows the design's sixteen defaults, nine of which can be started from", () => {
    expect(DEFAULT_BADGES).toHaveLength(16);
    expect(ROLE_PRESETS.map((p) => p.name)).toEqual(["Helper", "Coach", "Event host", "Streamer", "Artist", "Developer", "Supporter", "Ranked", "Veteran"]);
    for (const preset of DEFAULT_BADGES) expect(BADGE_GLYPHS[preset.glyph]).toBeDefined();
  });

  it("compares badges and knows which privileges let a role moderate", () => {
    expect(sameBadge(null, undefined)).toBe(true);
    expect(sameBadge({ tier: "staff", tone: "sky", glyph: "shield" }, { tier: "staff", tone: "sky", glyph: "shield" })).toBe(true);
    expect(sameBadge({ tier: "staff", tone: "sky", glyph: "shield" }, { tier: "staff", tone: "sage", glyph: "shield" })).toBe(false);
    expect(sameBadge({ tier: "staff", tone: "sky", glyph: "shield" }, null)).toBe(false);
    expect(canModerate(["send_messages"])).toBe(false);
    expect(canModerate(new Set(["mute_users"]))).toBe(true);
  });
});

describe("RoleBadge", () => {
  it("is a named image when it has a label and decoration when it has none", () => {
    const { container, rerender } = render(<RoleBadge badge={{ tier: "staff", tone: "sky", glyph: "shield" }} size={20} label="Moderator" />);
    expect(screen.getByRole("img", { name: "Moderator" })).toHaveAttribute("width", "20");
    rerender(<RoleBadge badge={{ tier: "staff", tone: "sky", glyph: "shield" }} />);
    expect(screen.queryByRole("img")).toBeNull();
    expect(container.querySelector("svg")).toHaveAttribute("aria-hidden", "true");
  });

  it("crops an uploaded picture to the tier's shape", () => {
    const { container } = render(<RoleBadge badge={{ tier: "community", tone: "violet", glyph: "image", image_url: "https://x.test/b.png" }} label="Artist" />);
    expect(container.querySelector("image")).toHaveAttribute("href", "https://x.test/b.png");
    expect(container.querySelector("clipPath path")).toHaveAttribute("d", BADGE_SHAPES.community);
  });
});
