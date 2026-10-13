import { useMemo, useState } from "react";
import { Play } from "lucide-react";
import { resolveEmbed, type IframeEmbed, type MediaEmbed } from "../../lib/embeds";

/** An inline player or preview for a link, or nothing when the link isn't one we can show. */
export function LinkEmbed({ url }: { url: string }) {
  const embed = useMemo(() => resolveEmbed(url), [url]);
  if (!embed) return null;
  return embed.kind === "iframe" ? <IframeCard embed={embed} /> : <DirectMedia embed={embed} />;
}

/**
 * Just the player, under the link the message already shows. It sits behind a click-to-load
 * placeholder of the same size, so the third-party site is only contacted (and can only track)
 * once someone asks for it, and a busy channel doesn't spin up a dozen players at once.
 */
function IframeCard({ embed }: { embed: IframeEmbed }) {
  const [loaded, setLoaded] = useState(false);
  const size = embed.aspect ? { aspectRatio: String(embed.aspect) } : { height: embed.height };
  return (
    <div className="relative mt-2 w-full overflow-hidden rounded-xl bg-background-secondary" style={{ maxWidth: embed.maxWidth ?? 480, ...size }}>
      {loaded ? (
        <iframe
          src={embed.src}
          title={`${embed.provider} player`}
          className="absolute inset-0 h-full w-full border-0"
          allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
        />
      ) : (
        <button
          type="button"
          onClick={() => setLoaded(true)}
          aria-label={`Load ${embed.provider} player`}
          className="group/play absolute inset-0 grid place-items-center outline-none"
        >
          <span className="flex flex-col items-center gap-2.5 px-4 text-center">
            <span
              className="grid size-14 place-items-center rounded-full bg-black/55 text-white transition-transform group-hover/play:scale-105 group-focus-visible/play:scale-105"
              style={{ boxShadow: `0 0 0 2px ${embed.color}` }}
            >
              <Play size={24} fill="currentColor" className="ml-0.5" />
            </span>
            <span className="text-[12px] text-text-muted">Click to load {embed.provider}</span>
          </span>
        </button>
      )}
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
      <a href={embed.url} target="_blank" rel="noreferrer noopener" className="inline-block max-w-full">
        <img src={embed.url} alt="" loading="lazy" referrerPolicy="no-referrer" onError={fail} className={frame} />
      </a>
    );
  }
  if (embed.kind === "video") {
    return <video src={embed.url} controls preload="metadata" onError={fail} className={`${frame} bg-black`} />;
  }
  return <audio src={embed.url} controls preload="none" onError={fail} className="mt-2 block w-full max-w-[400px]" />;
}
