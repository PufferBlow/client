export interface EmbedFrameConfig {
  src: string;
  title: string;
  allow?: string;
  sandbox?: string;
  aspectRatio?: "video" | "wide" | "card" | "audio";
  /** Max pixel width for the embed card. Defaults to full message width if omitted. */
  maxWidth?: number;
  /** Fixed pixel height. When set, overrides aspectRatio-based height. */
  fixedHeight?: number;
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
        maxWidth: 480,
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
          maxWidth: 480,
        },
      };
    }
  }

  if (host === "open.spotify.com") {
    const [resource, resourceId] = parsed.pathname.split("/").filter(Boolean);
    if (resource && resourceId) {
      const isTrack = resource === "track" || resource === "episode";
      return {
        provider: "Spotify",
        iframe: {
          src: `https://open.spotify.com/embed/${resource}/${resourceId}`,
          title: "Spotify preview",
          allow: "autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          maxWidth: 352,
          fixedHeight: isTrack ? 152 : 352,
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
          maxWidth: 540,
          fixedHeight: 320,
        },
      };
    }
  }

  if (host === "soundcloud.com" || host === "on.soundcloud.com") {
    const embedUrl = new URL("https://w.soundcloud.com/player/");
    embedUrl.searchParams.set("url", parsed.toString());
    embedUrl.searchParams.set("auto_play", "false");
    embedUrl.searchParams.set("hide_related", "true");
    embedUrl.searchParams.set("show_comments", "false");
    embedUrl.searchParams.set("show_user", "true");
    embedUrl.searchParams.set("show_reposts", "false");
    embedUrl.searchParams.set("visual", "false");

    return {
      provider: "SoundCloud",
      iframe: {
        src: embedUrl.toString(),
        title: "SoundCloud preview",
        allow: "autoplay",
        sandbox: "allow-scripts allow-same-origin allow-popups",
        maxWidth: 400,
        fixedHeight: 166,
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
        maxWidth: 325,
        fixedHeight: 735,
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
          maxWidth: 480,
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
          maxWidth: 580,
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
        maxWidth: 580,
      },
    };
  }

  // Apple Music — embed.music.apple.com supports iframe for albums,
  // songs, playlists. Translate any plain music.apple.com URL to the
  // embed host.
  if (host === "music.apple.com" || host === "embed.music.apple.com") {
    const embedHost = "embed.music.apple.com";
    const embedUrl = new URL(`https://${embedHost}${parsed.pathname}${parsed.search}`);
    return {
      provider: "Apple Music",
      iframe: {
        src: embedUrl.toString(),
        title: "Apple Music preview",
        allow:
          "autoplay *; encrypted-media *; fullscreen *; clipboard-write",
        sandbox: "allow-scripts allow-same-origin allow-popups allow-forms",
        maxWidth: 480,
        fixedHeight: 175,
      },
    };
  }

  // Twitter / X — there's no first-party iframe endpoint anymore, so
  // we route through twitframe.com (an open-source proxy widget). If
  // twitframe is unreachable the iframe stays blank; the surrounding
  // <MessageEmbeds> handles fade-out via onError (see component).
  if (host === "twitter.com" || host === "x.com" || host === "mobile.twitter.com") {
    const match = parsed.pathname.match(/^\/[^/]+\/status\/(\d+)/);
    if (match) {
      const tweetUrl = `https://twitter.com${parsed.pathname}`;
      return {
        provider: host === "x.com" ? "X" : "Twitter",
        iframe: {
          src: `https://twitframe.com/show?url=${encodeURIComponent(tweetUrl)}`,
          title: "Tweet preview",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          maxWidth: 520,
          fixedHeight: 480,
        },
      };
    }
  }

  // Instagram — posts, reels, and tv via the /embed/captioned path.
  // Requires `allow-scripts` for the embed's lazy-loading script.
  if (host === "instagram.com" || host === "www.instagram.com") {
    const match = parsed.pathname.match(/^\/(?:p|reel|tv)\/([\w-]+)/);
    if (match) {
      const kind = parsed.pathname.split("/")[1];
      return {
        provider: "Instagram",
        iframe: {
          src: `https://www.instagram.com/${kind}/${match[1]}/embed/captioned`,
          title: "Instagram preview",
          sandbox: "allow-scripts allow-same-origin allow-popups",
          maxWidth: 520,
          fixedHeight: 720,
        },
      };
    }
  }

  // GitHub — gists embed via srcdoc loading the gist's JS embed
  // script. The script writes the gist's HTML into the iframe's
  // document. For repos / PRs / issues GitHub blocks iframing via
  // X-Frame-Options:deny, so we don't try those -- the surrounding
  // MessageEmbeds will just render a link card.
  if (host === "gist.github.com") {
    const match = parsed.pathname.match(/^\/[^/]+\/([a-f0-9]+)/);
    if (match) {
      const gistJsUrl = `https://gist.github.com${parsed.pathname}.js`;
      const srcdoc = `<html><body style="margin:0"><script src="${gistJsUrl}"></script></body></html>`;
      return {
        provider: "GitHub Gist",
        iframe: {
          src: `data:text/html;charset=utf-8,${encodeURIComponent(srcdoc)}`,
          title: "Gist preview",
          sandbox: "allow-scripts",
          maxWidth: 580,
          fixedHeight: 400,
        },
      };
    }
  }

  // GitLab — same srcdoc pattern for snippets. GitLab self-hosted
  // instances vary; we only handle gitlab.com to keep this safe.
  if (host === "gitlab.com") {
    const match = parsed.pathname.match(/^\/(?:-\/snippets|.+\/-\/snippets)\/(\d+)/);
    if (match) {
      const snippetEmbedUrl = `https://gitlab.com${parsed.pathname}.js`;
      const srcdoc = `<html><body style="margin:0"><script src="${snippetEmbedUrl}"></script></body></html>`;
      return {
        provider: "GitLab Snippet",
        iframe: {
          src: `data:text/html;charset=utf-8,${encodeURIComponent(srcdoc)}`,
          title: "GitLab snippet preview",
          sandbox: "allow-scripts",
          maxWidth: 580,
          fixedHeight: 400,
        },
      };
    }
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

  // Strip markdown-blockquote lines BEFORE scanning for URLs.
  // The reply composer wraps the original message's text as a
  // blockquote ("> Replying to @x\n> <quoted text>\n\n<reply>"),
  // and any link inside the quoted text gets pulled into a full
  // iframe embed when the reply renders — which is exactly the
  // "loading iframes of a link we are replying to" behavior we
  // want to suppress. Links the user typed in their own reply
  // body (outside the blockquote) still embed normally.
  const visibleContent = content
    .split("\n")
    .filter((line) => !line.trimStart().startsWith(">"))
    .join("\n");

  const matches = visibleContent.match(URL_PATTERN) || [];
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
