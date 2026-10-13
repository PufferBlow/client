import { describe, expect, it } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { DEFAULT_REACTIONS, recordReaction, topReactions, useTopReactions } from "./reactionUsage";

describe("reaction usage", () => {
  it("starts from the defaults", () => {
    expect(topReactions(4)).toEqual(DEFAULT_REACTIONS);
    expect(topReactions(1)).toEqual(["👍"]);
  });

  it("ranks by how often, then how recently, and pads with the defaults", () => {
    recordReaction("🔥");
    recordReaction("🔥");
    recordReaction("😂");
    expect(topReactions(4)).toEqual(["🔥", "😂", "👍", "❤️"]);
  });

  it("survives a reload", () => {
    recordReaction("🦄");
    expect(JSON.parse(localStorage.getItem("pb_reaction_usage")!)).toHaveProperty("🦄");
  });

  it("updates subscribers when a reaction is used", () => {
    const { result } = renderHook(() => useTopReactions(1));
    expect(result.current).toEqual(["👍"]);
    act(() => {
      recordReaction("🎯");
    });
    expect(result.current).toEqual(["🎯"]);
  });
});
