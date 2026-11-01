import { describe, expect, it } from "vitest";
import { isDeletedAccount, shownName } from "./deletedAccount";

describe("deleted accounts", () => {
  it("shows the name an erased account is left under as Deleted user", () => {
    expect(shownName("deleted_1a2b3c4d")).toBe("Deleted user");
    expect(isDeletedAccount("deleted_1a2b3c4d")).toBe(true);
  });

  it("leaves everyone else's name alone, including ones that only look similar", () => {
    for (const name of [
      "ada",
      "deleted_user",
      "deleted_1a2b3c4",
      "deleted_1a2b3c4d5",
      "xdeleted_1a2b3c4d",
      "Deleted_1A2B3C4D",
    ]) {
      expect(shownName(name)).toBe(name);
    }
    expect(isDeletedAccount(null)).toBe(false);
  });
});
