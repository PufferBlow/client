import { useMemo, useState } from "react";
import { resolveEmbed, type IframeEmbed, type MediaEmbed } from "../../lib/embeds";

/** An inline player or preview for a link, or nothing when the link isn't one we can show. */
export function LinkEmbed({ url }: { url: string }) {
  const embed = useMemo(() => resolveEmbed(url), [url]);
  if (!embed) return null;
  return embed.kind === "iframe" ? <IframeCard embed={embed} /> : <DirectMedia embed={embed} />;
}

/**
 * Just the player, under the link the message already shows. Loaded lazily, so only players
 * scrolled into view are fetched rather than every one in the history.
 */
function IframeCard({ embed }: { embed: IframeEmbed }) {
  const size = embed.aspect ? { aspectRatio: String(embed.aspect) } : { height: embed.height };
  return (
    <div className={`relative mt-2 w-full overflow-hidden rounded-xl ${embed.srcDoc !== undefined ? "bg-white" : "bg-background-secondary"}`} style={{ maxWidth: embed.maxWidth ?? 480, ...size }}>
      <iframe
        {...(embed.srcDoc !== undefined ? { srcDoc: embed.srcDoc } : { src: embed.src })}
        title={`${embed.provider} embed`}
        loading="lazy"
        className="absolute inset-0 h-full w-full border-0"
        allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        // A page we wrote ourselves runs a provider's script, so it gets no same-origin access to this app.
        sandbox={`allow-scripts ${embed.srcDoc !== undefined ? "" : "allow-same-origin "}allow-popups allow-popups-to-escape-sandbox allow-presentation`}
      />
    </div>
  );
}

/** A linked image, video or audio file, shown as itself. Hidden if it fails to load. */
function DirectMedia({ embed }: { embed: MediaEmbed }) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const fail = () => setFailed(true);
  const frame = "mt-2 block max-h-80 max-w-[min(100%,480px)] rounded-xl border border-border-secondary";

  if (embed.kind === "image") {
    return (
      <a href={embed.href ?? embed.url} target="_blank" rel="noreferrer noopener" className="inline-block max-w-full">
        <img src={embed.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={fail} className={frame} />
      </a>
    );
  }
  if (embed.kind === "video") {
    return <video src={embed.url} controls preload="metadata" onError={fail} className={`${frame} bg-black`} />;
  }
  return <audio src={embed.url} controls preload="none" onError={fail} className="mt-2 block w-full max-w-[400px]" />;
}
