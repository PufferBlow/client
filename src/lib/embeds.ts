/**
 * Turns a link posted in a message into something playable inline: an iframe player for popular
 * sites, or the file itself for direct image/video/audio links. Only URLs we recognise become
 * iframes, and the iframe `src` is always built here from the parsed ID, never taken from the
 * message, so a message can't point an iframe anywhere else. Players load with the message, so
 * none of them autoplay (Twitch, which does by default, is told not to).
 */

export interface IframeEmbed {
  kind: "iframe";
  provider: string;
  /** Provider brand colour, for the card's accent. */
  color: string;
  /** The link as posted. */
  url: string;
  src: string;
  /** Width / height for players that scale (video); otherwise a fixed `height` in px. */
  aspect?: number;
  height?: number;
  /** Narrower than the default card, e.g. vertical video. */
  maxWidth?: number;
}

export interface MediaEmbed {
  kind: "image" | "video" | "audio";
  url: string;
}

export type Embed = IframeEmbed | MediaEmbed;

/** `base?query`, or just `base` when there are no parameters. */
const withQuery = (base: string, params: URLSearchParams) => (params.size ? `${base}?${params}` : base);

const IMAGE = /\.(png|jpe?g|gif|webp|avif|bmp)$/i;
const VIDEO = /\.(mp4|webm|mov|m4v|ogv)$/i;
const AUDIO = /\.(mp3|ogg|oga|wav|flac|m4a|opus)$/i;

/** `location.hostname`, which Twitch requires as `parent`; empty when the app runs from file://. */
const currentHost = () => (typeof location === "undefined" ? "" : location.hostname);

export function resolveEmbed(raw: string, parentHost = currentHost()): Embed | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const host = url.hostname.replace(/^(www|m)\./, "").toLowerCase();
  const path = url.pathname.split("/").filter(Boolean);
  const href = url.href;

  const iframe = (provider: string, color: string, src: string, size: Pick<IframeEmbed, "aspect" | "height" | "maxWidth">): IframeEmbed => ({
    kind: "iframe",
    provider,
    color,
    url: href,
    src,
    ...size,
  });

  // YouTube: watch?v=, youtu.be/ID, /shorts/ID, /embed/ID, /live/ID, playlists.
  if (host === "youtube.com" || host === "music.youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com") {
    let id: string | null = null;
    let vertical = false;
    if (host === "youtu.be") id = path[0] ?? null;
    else if (path[0] === "watch") id = url.searchParams.get("v");
    else if (path[0] === "shorts" || path[0] === "embed" || path[0] === "live") {
      id = path[1] ?? null;
      vertical = path[0] === "shorts";
    }
    const list = url.searchParams.get("list");
    const params = new URLSearchParams();
    const start = parseTimestamp(url.searchParams.get("t") ?? url.searchParams.get("start"));
    if (start) params.set("start", String(start));
    if (id && /^[\w-]{11}$/.test(id)) {
      if (list && /^[\w-]+$/.test(list)) params.set("list", list);
      return iframe("YouTube", "#ff0033", withQuery(`https://www.youtube-nocookie.com/embed/${id}`, params), vertical ? { aspect: 9 / 16, maxWidth: 315 } : { aspect: 16 / 9 });
    }
    if (path[0] === "playlist" && list && /^[\w-]+$/.test(list)) {
      params.set("list", list);
      return iframe("YouTube", "#ff0033", `https://www.youtube-nocookie.com/embed/videoseries?${params}`, { aspect: 16 / 9 });
    }
    return null;
  }

  // Vimeo: vimeo.com/ID, or vimeo.com/ID/HASH for unlisted videos.
  if (host === "vimeo.com" && path[0] && /^\d+$/.test(path[0])) {
    const params = new URLSearchParams({ dnt: "1" });
    if (path[1] && /^[\da-f]+$/i.test(path[1])) params.set("h", path[1]);
    return iframe("Vimeo", "#1ab7ea", `https://player.vimeo.com/video/${path[0]}?${params}`, { aspect: 16 / 9 });
  }

  // Spotify: open.spotify.com/(intl-xx/)TYPE/ID.
  if (host === "open.spotify.com") {
    const parts = path[0]?.startsWith("intl-") ? path.slice(1) : path;
    const [type, id] = parts;
    if (type && id && /^(track|album|playlist|episode|show|artist)$/.test(type) && /^[A-Za-z0-9]{22}$/.test(id)) {
      const compact = type === "track" || type === "episode";
      return iframe("Spotify", "#1db954", `https://open.spotify.com/embed/${type}/${id}`, { height: compact ? 152 : 352 });
    }
    return null;
  }

  // SoundCloud: soundcloud.com/USER/TRACK or /USER/sets/SET.
  if (host === "soundcloud.com" && path.length >= 2 && path.every((p) => /^[\w-]+$/.test(p))) {
    const clean = `https://soundcloud.com/${path.join("/")}`;
    const set = path[1] === "sets";
    const params = new URLSearchParams({ url: clean, visual: "false", color: "#e3ae4f" });
    return iframe("SoundCloud", "#ff5500", `https://w.soundcloud.com/player/?${params}`, { height: set ? 352 : 166 });
  }

  // Twitch: VODs, clips and channels. The player refuses to load without `parent`.
  if ((host === "twitch.tv" || host === "clips.twitch.tv") && parentHost) {
    const parent = encodeURIComponent(parentHost);
    let clip: string | undefined;
    if (host === "clips.twitch.tv") clip = path[0];
    else if (path[1] === "clip") clip = path[2];
    if (clip && /^[\w-]+$/.test(clip)) {
      return iframe("Twitch", "#9146ff", `https://clips.twitch.tv/embed?clip=${clip}&parent=${parent}&autoplay=false`, { aspect: 16 / 9 });
    }
    if (path[0] === "videos" && path[1] && /^\d+$/.test(path[1])) {
      return iframe("Twitch", "#9146ff", `https://player.twitch.tv/?video=${path[1]}&parent=${parent}&autoplay=false`, { aspect: 16 / 9 });
    }
    if (host === "twitch.tv" && path.length === 1 && path[0] && /^\w{3,25}$/.test(path[0])) {
      return iframe("Twitch", "#9146ff", `https://player.twitch.tv/?channel=${path[0]}&parent=${parent}&autoplay=false`, { aspect: 16 / 9 });
    }
    return null;
  }

  // X / Twitter posts.
  if ((host === "twitter.com" || host === "x.com") && path[1] === "status" && path[2] && /^\d+$/.test(path[2])) {
    return iframe("X", "#e7e9ea", `https://platform.twitter.com/embed/Tweet.html?id=${path[2]}&theme=dark&dnt=true`, { height: 520, maxWidth: 550 });
  }

  // TikTok videos.
  if (host === "tiktok.com" && path[1] === "video" && path[2] && /^\d+$/.test(path[2])) {
    return iframe("TikTok", "#fe2c55", `https://www.tiktok.com/embed/v2/${path[2]}`, { height: 740, maxWidth: 340 });
  }

  // Streamable, Loom, CodePen.
  if (host === "streamable.com" && path.length === 1 && path[0] && /^\w+$/.test(path[0])) {
    return iframe("Streamable", "#0f90fa", `https://streamable.com/e/${path[0]}`, { aspect: 16 / 9 });
  }
  if (host === "loom.com" && path[0] === "share" && path[1] && /^[\da-f]{32}$/i.test(path[1])) {
    return iframe("Loom", "#625df5", `https://www.loom.com/embed/${path[1]}`, { aspect: 16 / 9 });
  }
  if (host === "codepen.io" && path[1] === "pen" && path[0] && path[2] && /^[\w-]+$/.test(path[0]) && /^\w+$/.test(path[2])) {
    return iframe("CodePen", "#c9c9c9", `https://codepen.io/${path[0]}/embed/${path[2]}?default-tab=result&theme-id=dark`, { height: 400 });
  }

  // A direct link to a file.
  if (IMAGE.test(url.pathname)) return { kind: "image", url: href };
  if (VIDEO.test(url.pathname)) return { kind: "video", url: href };
  if (AUDIO.test(url.pathname)) return { kind: "audio", url: href };
  return null;
}

/** `90`, `90s`, `1m30s`, `1h2m3s` → seconds; null when absent or unreadable. */
export function parseTimestamp(value: string | null): number | null {
  if (!value) return null;
  if (/^\d+s?$/.test(value)) return Number.parseInt(value, 10) || null;
  const match = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s)?$/.exec(value);
  if (!match || !match[0]) return null;
  const [, h = "0", m = "0", s = "0"] = match;
  return Number(h) * 3600 + Number(m) * 60 + Number(s) || null;
}
