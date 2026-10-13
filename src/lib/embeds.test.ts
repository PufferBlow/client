import { describe, expect, it } from "vitest";
import { parseTimestamp, resolveEmbed, type IframeEmbed } from "./embeds";

const src = (url: string, host = "app.example") => (resolveEmbed(url, host) as IframeEmbed | null)?.src;

describe("resolveEmbed", () => {
  it("embeds YouTube videos from every URL shape, privacy-enhanced", () => {
    const id = "dQw4w9WgXcQ";
    for (const url of [
      `https://www.youtube.com/watch?v=${id}`,
      `https://youtu.be/${id}`,
      `https://m.youtube.com/watch?v=${id}&feature=share`,
      `https://youtube.com/embed/${id}`,
      `https://music.youtube.com/watch?v=${id}`,
    ]) {
      expect(src(url)).toBe(`https://www.youtube-nocookie.com/embed/${id}`);
    }
  });

  it("never asks a player to autoplay", () => {
    for (const url of ["https://youtu.be/dQw4w9WgXcQ", "https://vimeo.com/1", "https://soundcloud.com/a/b", "https://streamable.com/x", "https://www.loom.com/share/0123456789abcdef0123456789abcdef"]) {
      expect(src(url)).not.toMatch(/auto_?play=(1|true)/);
    }
  });

  it("keeps the YouTube start time and draws Shorts vertical", () => {
    expect(src("https://youtu.be/dQw4w9WgXcQ?t=1m30s")).toContain("start=90");
    expect(resolveEmbed("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toMatchObject({ aspect: 9 / 16, maxWidth: 315 });
  });

  it("embeds YouTube playlists", () => {
    expect(src("https://www.youtube.com/playlist?list=PL123abc")).toBe(
      "https://www.youtube-nocookie.com/embed/videoseries?list=PL123abc",
    );
  });

  it("rejects malformed YouTube IDs", () => {
    expect(resolveEmbed("https://www.youtube.com/watch?v=short")).toBeNull();
    expect(resolveEmbed('https://youtu.be/"><script>')).toBeNull();
  });

  it("embeds Vimeo, including unlisted hashes", () => {
    expect(src("https://vimeo.com/76979871")).toBe("https://player.vimeo.com/video/76979871?dnt=1");
    expect(src("https://vimeo.com/76979871/abc123")).toContain("h=abc123");
  });

  it("embeds Spotify tracks compact and collections tall", () => {
    expect(resolveEmbed("https://open.spotify.com/intl-de/track/4uLU6hMCjMI75M1A2tKUQC")).toMatchObject({
      src: "https://open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
      height: 152,
    });
    expect(resolveEmbed("https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M")).toMatchObject({ height: 352 });
  });

  it("embeds SoundCloud through its widget", () => {
    expect(src("https://soundcloud.com/artist/track-name")).toBe(
      "https://w.soundcloud.com/player/?url=https%3A%2F%2Fsoundcloud.com%2Fartist%2Ftrack-name&visual=false&color=%23e3ae4f",
    );
  });

  it("embeds Twitch with the page as parent, and not at all without one", () => {
    expect(src("https://www.twitch.tv/videos/123456")).toBe("https://player.twitch.tv/?video=123456&parent=app.example&autoplay=false");
    expect(src("https://clips.twitch.tv/FunnyClipSlug")).toContain("clip=FunnyClipSlug&parent=app.example");
    expect(src("https://www.twitch.tv/somechannel")).toContain("channel=somechannel");
    expect(resolveEmbed("https://www.twitch.tv/somechannel", "")).toBeNull();
  });

  it("embeds X posts, TikToks, Streamable, Loom and CodePen", () => {
    expect(src("https://x.com/user/status/1234567890")).toContain("platform.twitter.com/embed/Tweet.html?id=1234567890");
    expect(src("https://twitter.com/user/status/1234567890")).toContain("id=1234567890");
    expect(src("https://www.tiktok.com/@user/video/7000000000000000000")).toBe("https://www.tiktok.com/embed/v2/7000000000000000000");
    expect(src("https://streamable.com/abc12")).toBe("https://streamable.com/e/abc12");
    expect(src("https://www.loom.com/share/0123456789abcdef0123456789abcdef")).toContain("loom.com/embed/0123456789abcdef");
    expect(src("https://codepen.io/someone/pen/AbCdEf")).toContain("codepen.io/someone/embed/AbCdEf");
  });

  it("shows direct media links as the file itself", () => {
    expect(resolveEmbed("https://cdn.example/cat.GIF")).toEqual({ kind: "image", url: "https://cdn.example/cat.GIF" });
    expect(resolveEmbed("https://cdn.example/clip.mp4?x=1")).toMatchObject({ kind: "video" });
    expect(resolveEmbed("https://cdn.example/song.mp3")).toMatchObject({ kind: "audio" });
  });

  it("ignores everything else", () => {
    expect(resolveEmbed("https://example.com/page")).toBeNull();
    expect(resolveEmbed("ftp://example.com/a.png")).toBeNull();
    expect(resolveEmbed("not a url")).toBeNull();
  });
});

describe("parseTimestamp", () => {
  it("reads seconds and h/m/s forms", () => {
    expect(parseTimestamp("90")).toBe(90);
    expect(parseTimestamp("90s")).toBe(90);
    expect(parseTimestamp("1h2m3s")).toBe(3723);
    expect(parseTimestamp("nope")).toBeNull();
    expect(parseTimestamp(null)).toBeNull();
  });
});
