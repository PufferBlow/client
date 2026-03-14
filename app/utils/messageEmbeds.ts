export interface EmbedFrameConfig {
  src: string;
  title: string;
  allow?: string;
  sandbox?: string;
  aspectRatio?: "video" | "wide" | "card" | "audio";
}

export interface MessageEmbedPreview {
  url: string;
  normalizedUrl: string;
  hostname: string;
  displayText: string;
  provider: string;
  iframe?: EmbedFrameConfig;
}

const URL_PATTERN = /\bhttps?:\/\/[^\s<>()]+/gi;

const trimTrailingPunctuation = (value: string): string =>
  value.replace(/[),.;!?]+$/g, "");

const normalizePreviewUrl = (rawUrl: string): URL | null => {
  try {
    return new URL(trimTrailingPunctuation(rawUrl));
  } catch {
    return null;
  }
};

const extractYouTubeId = (parsed: URL): string | null => {
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host === "youtu.be") {
    return parsed.pathname.split("/").filter(Boolean)[0] || null;
  }

  if (host === "youtube.com" || host === "m.youtube.com") {
    if (parsed.pathname === "/watch") {
      return parsed.searchParams.get("v");
    }

    if (parsed.pathname.startsWith("/shorts/") || parsed.pathname.startsWith("/embed/")) {
      return parsed.pathname.split("/").filter(Boolean)[1] || null;
    }
  }

  return null;
};

const extractTikTokId = (parsed: URL): string | null => {
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();
  if (host !== "tiktok.com" && host !== "m.tiktok.com") {
    return null;
  }

  const match = parsed.pathname.match(/\/video\/(\d+)/);
  return match?.[1] || null;
};

const resolveIframePreview = (parsed: URL): { provider: string; iframe?: EmbedFrameConfig } => {
  const host = parsed.hostname.replace(/^www\./, "").toLowerCase();

  const youTubeId = extractYouTubeId(parsed);
  if (youTubeId) {
    return {
      provider: "YouTube",
      iframe: {
        src: `https://www.youtube-nocookie.com/embed/${youTubeId}`,
        title: "YouTube preview",
        allow:
          "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share",
        sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
        aspectRatio: "video",
      },
    };
  }

  if (host === "vimeo.com" || host === "player.vimeo.com") {
    const videoId = parsed.pathname.split("/").filter(Boolean).find((part) => /^\d+$/.test(part));
    if (videoId) {
      return {
        provider: "Vimeo",
        iframe: {
          src: `https://player.vimeo.com/video/${videoId}`,
          title: "Vimeo preview",
          allow: "autoplay; fullscreen; picture-in-picture",
          sandbox: "allow-scripts allow-same-origin allow-presentation allow-popups",
          aspectRatio: "video",
        },
      };
    }
  }

  if (host === "open.spotify.com") {
    const [resource, resourceId] = parsed.pathname.split("/").filter(Boolean);
    if (resource && resourceId) {
      return {
        provider: "Spotify",
        iframe: {
          src: `https://open.spotify.com/embed/${resource}/${resourceId}`,
          title: "Spotify preview",
          allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          aspectRatio: "card",
        },
      };
    }
  }

  if (host === "reddit.com" || host === "old.reddit.com" || host === "redditmedia.com") {
    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (pathname.includes("/comments/")) {
      const embedUrl = new URL(`https://www.redditmedia.com${pathname}`);
      embedUrl.searchParams.set("ref_source", "embed");
      embedUrl.searchParams.set("ref", "share");
      embedUrl.searchParams.set("embed", "true");

      return {
        provider: "Reddit",
        iframe: {
          src: embedUrl.toString(),
          title: "Reddit preview",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          aspectRatio: "card",
        },
      };
    }
  }

  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    const embedUrl = new URL("https://w.soundcloud.com/player/");
    embedUrl.searchParams.set("url", parsed.toString());
    embedUrl.searchParams.set("auto_play", "false");
    embedUrl.searchParams.set("hide_related", "false");
    embedUrl.searchParams.set("show_comments", "true");
    embedUrl.searchParams.set("show_user", "true");
    embedUrl.searchParams.set("show_reposts", "false");
    embedUrl.searchParams.set("visual", "true");

    return {
      provider: "SoundCloud",
      iframe: {
        src: embedUrl.toString(),
        title: "SoundCloud preview",
        allow: "autoplay",
        sandbox: "allow-scripts allow-same-origin allow-popups",
        aspectRatio: "card",
      },
    };
  }

  const tikTokId = extractTikTokId(parsed);
  if (tikTokId) {
    return {
      provider: "TikTok",
      iframe: {
        src: `https://www.tiktok.com/embed/v2/${tikTokId}`,
        title: "TikTok preview",
        allow: "autoplay; encrypted-media; fullscreen; picture-in-picture",
        sandbox: "allow-scripts allow-same-origin allow-popups",
        aspectRatio: "wide",
      },
    };
  }

  if (host === "loom.com" || host === "www.loom.com") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    const shareIndex = segments.findIndex((segment) => segment === "share");
    const shareId = shareIndex >= 0 ? segments[shareIndex + 1] : null;
    if (shareId) {
      return {
        provider: "Loom",
        iframe: {
          src: `https://www.loom.com/embed/${shareId}`,
          title: "Loom preview",
          allow: "autoplay; fullscreen; picture-in-picture",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          aspectRatio: "video",
        },
      };
    }
  }

  if (host === "codepen.io") {
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (segments.length >= 3 && segments[1] === "pen") {
      return {
        provider: "CodePen",
        iframe: {
          src: `https://codepen.io/${segments[0]}/embed/${segments[2]}?default-tab=result`,
          title: "CodePen preview",
          allow: "clipboard-write",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          aspectRatio: "wide",
        },
      };
    }
  }

  if (host === "figma.com" || host === "www.figma.com") {
    const embedUrl = new URL("https://www.figma.com/embed");
    embedUrl.searchParams.set("embed_host", "pufferblow");
    embedUrl.searchParams.set("url", parsed.toString());

    return {
      provider: "Figma",
      iframe: {
        src: embedUrl.toString(),
        title: "Figma preview",
        sandbox: "allow-scripts allow-same-origin allow-popups",
        aspectRatio: "wide",
      },
    };
  }

  return {
    provider: parsed.hostname.replace(/^www\./, ""),
  };
};

export const extractMessageEmbeds = (
  content: string,
  maxEmbeds: number = 3,
): MessageEmbedPreview[] => {
  if (!content) {
    return [];
  }

  const matches = content.match(URL_PATTERN) || [];
  const uniqueUrls = new Set<string>();
  const previews: MessageEmbedPreview[] = [];

  for (const match of matches) {
    if (previews.length >= maxEmbeds) {
      break;
    }

    const parsed = normalizePreviewUrl(match);
    if (!parsed || (parsed.protocol !== "http:" && parsed.protocol !== "https:")) {
      continue;
    }

    const normalizedUrl = parsed.toString();
    if (uniqueUrls.has(normalizedUrl)) {
      continue;
    }
    uniqueUrls.add(normalizedUrl);

    const preview = resolveIframePreview(parsed);
    previews.push({
      url: match,
      normalizedUrl,
      hostname: parsed.hostname.replace(/^www\./, ""),
      displayText: parsed.hostname.replace(/^www\./, "") + parsed.pathname,
      provider: preview.provider,
      iframe: preview.iframe,
    });
  }

  return previews;
};
