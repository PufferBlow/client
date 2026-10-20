import { describe, expect, it } from "vitest";
import { parsePuff, PUFF_FACES, puffReaction } from "./puff";

describe("puff reactions", () => {
  it("round-trips every face through its reaction string", () => {
    expect(PUFF_FACES).toHaveLength(6);
    for (const { face, tone } of PUFF_FACES) {
      const parsed = parsePuff(puffReaction(face));
      expect(parsed).toMatchObject({ face, tone });
      expect(parsed!.url).toContain(`pb-avatar-${face}-${tone}`);
    }
  });

  it("leaves ordinary emoji and unknown faces alone", () => {
    expect(parsePuff("👍")).toBeUndefined();
    expect(parsePuff("puff:furious")).toBeUndefined();
    expect(parsePuff("sticker:1234")).toBeUndefined();
  });

  it("stays well under the server's 64 character limit", () => {
    for (const { face } of PUFF_FACES) expect(puffReaction(face).length).toBeLessThan(64);
  });
});
