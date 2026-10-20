import { describe, expect, it } from "vitest";
import { identity } from "../../lib/identity";
import { DEFAULT_SETTINGS, lookOf, randomSettings, settingsOf, settingsPatch } from "./look";

const ada = { username: "ada", origin_server: "chat.example", profile_settings: null };

describe("settingsOf", () => {
  it("gives the defaults to someone who chose nothing, as a copy", () => {
    const settings = settingsOf(ada);
    expect(settings).toEqual(DEFAULT_SETTINGS);
    settings.sections.play = false;
    expect(DEFAULT_SETTINGS.sections.play).toBe(true);
  });

  it("keeps what is valid and drops what is not", () => {
    const settings = settingsOf({
      profile_settings: { frame: "spines", tone: "sky", card_theme: "neon" as never, name_font: "marcellus", sections: { accounts: true, play: "yes" as never } },
    });
    expect(settings).toMatchObject({ frame: "spines", tone: "sky", card_theme: "mono", name_font: "marcellus" });
    expect(settings.sections).toEqual({ play: true, mains: true, accounts: true, badges: true });
  });
});

describe("lookOf", () => {
  it("falls back to what the handle gives", () => {
    const look = lookOf(ada);
    const derived = identity("ada@chat.example");
    expect(look).toMatchObject({ tone: derived.tone, expression: derived.expression, hex: derived.hex });
    expect(look.cardBackground).toBe("#1f1f1f"); // mono: nothing is tinted
    expect(look.ringSmall).toBe("none");
  });

  it("never mixes more than a quarter of the colour into the card, so white text stays readable", () => {
    for (const card_theme of ["tinted", "duo"] as const) {
      const look = lookOf(ada, { ...DEFAULT_SETTINGS, tone: "violet", tone2: "sky", card_theme });
      const percents = [...look.cardBackground.matchAll(/(\d+)%, #161616/g)].map((m) => Number(m[1]));
      expect(percents.length).toBeGreaterThan(0);
      for (const percent of percents) expect(percent).toBeLessThanOrEqual(24);
    }
  });

  it("uses a gradient banner for the duo choice and the second colour defaults to a different one", () => {
    const look = lookOf(ada, { ...DEFAULT_SETTINGS, tone: "violet", banner_pattern: "duo" });
    expect(look.tone2).not.toBe("violet");
    expect(look.banner).toContain("linear-gradient");
  });

  it("draws the frame as a ring in the colour", () => {
    expect(lookOf(ada, { ...DEFAULT_SETTINGS, tone: "coral", frame: "ring" }).ring).toContain("#ec8a6f");
    expect(lookOf(ada, { ...DEFAULT_SETTINGS, tone: "coral", frame: "spines" }).ringSmall).toContain("#ec8a6f");
  });
});

describe("settingsPatch", () => {
  it("sends only what changed, and sections one at a time", () => {
    const next = { ...DEFAULT_SETTINGS, frame: "ring" as const, sections: { ...DEFAULT_SETTINGS.sections, accounts: true } };
    expect(settingsPatch(DEFAULT_SETTINGS, next)).toEqual({ frame: "ring", sections: { accounts: true } });
    expect(settingsPatch(DEFAULT_SETTINGS, DEFAULT_SETTINGS)).toEqual({});
  });

  it("can send a choice back to null", () => {
    const chosen = { ...DEFAULT_SETTINGS, tone: "sky" as const };
    expect(settingsPatch(chosen, DEFAULT_SETTINGS)).toEqual({ tone: null });
  });
});

describe("randomSettings", () => {
  it("picks only allowed values and leaves the sections alone", () => {
    const base = { ...DEFAULT_SETTINGS, sections: { ...DEFAULT_SETTINGS.sections, accounts: true } };
    for (const r of [0, 0.5, 0.999]) {
      const picked = randomSettings(base, () => r);
      expect(settingsOf({ profile_settings: picked })).toEqual(picked); // survives validation unchanged
      expect(picked.sections).toEqual(base.sections);
    }
  });
});
