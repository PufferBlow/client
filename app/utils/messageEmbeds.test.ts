import { describe, expect, it } from "vitest";

import { extractMessageEmbeds } from "./messageEmbeds";

describe("extractMessageEmbeds", () => {
  it("extracts embeddable YouTube links", () => {
    const previews = extractMessageEmbeds(
      "Watch this https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("YouTube");
    expect(previews[0]?.iframe?.src).toContain("youtube-nocookie.com/embed/dQw4w9WgXcQ");
  });

  it("deduplicates repeated URLs", () => {
    const previews = extractMessageEmbeds(
      "https://example.org/test https://example.org/test",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("example.org");
    expect(previews[0]?.iframe).toBeUndefined();
  });

  it("trims trailing punctuation from detected URLs", () => {
    const previews = extractMessageEmbeds(
      "Read this article: https://example.org/path/to/post).",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.normalizedUrl).toBe("https://example.org/path/to/post");
  });

  it("extracts Spotify embeds", () => {
    const previews = extractMessageEmbeds(
      "Listen https://open.spotify.com/track/4uLU6hMCjMI75M1A2tKUQC",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("Spotify");
    expect(previews[0]?.iframe?.src).toContain(
      "open.spotify.com/embed/track/4uLU6hMCjMI75M1A2tKUQC",
    );
  });

  it("extracts Reddit thread embeds", () => {
    const previews = extractMessageEmbeds(
      "Thread https://www.reddit.com/r/reactjs/comments/abc123/example_post/",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("Reddit");
    expect(previews[0]?.iframe?.src).toContain("redditmedia.com/r/reactjs/comments/abc123/example_post");
    expect(previews[0]?.iframe?.src).toContain("embed=true");
  });

  it("extracts TikTok embeds", () => {
    const previews = extractMessageEmbeds(
      "Clip https://www.tiktok.com/@creator/video/7350123456789012345",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("TikTok");
    expect(previews[0]?.iframe?.src).toContain(
      "tiktok.com/embed/v2/7350123456789012345",
    );
  });

  it("extracts CodePen embeds", () => {
    const previews = extractMessageEmbeds(
      "Pen https://codepen.io/example/pen/abCDeFG",
    );

    expect(previews).toHaveLength(1);
    expect(previews[0]?.provider).toBe("CodePen");
    expect(previews[0]?.iframe?.src).toContain(
      "codepen.io/example/embed/abCDeFG",
    );
  });
});
