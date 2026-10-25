import { describe, expect, it } from "vitest";
import { serverPictures } from "../features/server/look";
import { identity, spaceIconStyle } from "@pufferblow/spines";
import { serverLookOf } from "./serverLook";

describe("serverLookOf", () => {
  it("is what the address gives when the owner chose nothing", () => {
    const look = serverLookOf("lanes.gg");
    expect(look.tone).toBe(identity("lanes.gg").tone);
    expect(look.bannerPattern).toBe(identity("lanes.gg").pattern);
    expect(look.iconStyle).toBe(spaceIconStyle("lanes.gg"));
  });

  it("takes each choice the owner made and leaves the rest derived", () => {
    const look = serverLookOf("lanes.gg", { icon_style: "bubble", tone: "violet", banner_pattern: null });
    expect(look.iconStyle).toBe("bubble");
    expect(look.tone).toBe("violet");
    expect(look.bannerPattern).toBe(identity("lanes.gg").pattern);
  });

  it("draws two colours as a gradient, and the second colour never equals the first", () => {
    const look = serverLookOf("lanes.gg", { banner_pattern: "duo", tone: "sky" });
    expect(look.tone2).not.toBe(look.tone);
    expect(look.banner()).toContain("linear-gradient");
  });
});

describe("serverPictures", () => {
  it("counts only uploads as pictures, not the default art the server also hosts", () => {
    const art = { avatar_url: "http://x.test/assets/avatars/a.svg", banner_url: "http://x.test/assets/banners/b.svg" };
    expect(serverPictures({ ...art, avatar_kind: "identicon", banner_kind: "default" })).toEqual({ avatar: null, banner: null });
    expect(serverPictures({ ...art, avatar_kind: "image", banner_kind: "solid" })).toEqual({ avatar: "http://x.test/assets/avatars/a.svg", banner: null });
  });

  it("takes an older instance, which does not say what kind it is, at its word", () => {
    expect(serverPictures({ avatar_url: "http://x.test/a.png", banner_url: null }).avatar).toBe("http://x.test/a.png");
  });
});
