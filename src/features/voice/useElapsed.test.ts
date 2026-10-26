import { describe, expect, it } from "vitest";
import { formatElapsed } from "./useElapsed";

describe("the shared call timer", () => {
  it("counts in minutes and seconds, then hours", () => {
    expect(formatElapsed(0)).toBe("0:00");
    expect(formatElapsed(7_000)).toBe("0:07");
    expect(formatElapsed(247_000)).toBe("4:07");
    expect(formatElapsed(3_729_000)).toBe("1:02:09");
  });

  it("never goes below zero when this clock is behind the server's", () => {
    expect(formatElapsed(-5_000)).toBe("0:00");
  });
});
