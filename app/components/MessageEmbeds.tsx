import { useEffect, useRef, useState } from "react";
import { extractMessageEmbeds, type MessageEmbedPreview } from "../utils/messageEmbeds";

interface MessageEmbedsProps {
  content: string;
  className?: string;
}

const getFrameClassName = (aspectRatio?: "video" | "wide" | "card" | "audio") => {
  switch (aspectRatio) {
    case "wide":
      return "aspect-[16/10]";
    case "card":
      return "aspect-[16/9] md:aspect-[16/8]";
    case "audio":
      return "aspect-[16/5]";
    case "video":
    default:
      return "aspect-video";
  }
};

/**
 * Single embed card. Lifted into its own component so each one can
 * track its own iframe-load state -- when an iframe fails to load
 * (X-Frame-Options block, network error, server down), the card
 * removes itself from the DOM entirely. Same-origin iframes fire
 * `onError` reliably; cross-origin ones don't, so we also use a
 * timeout fallback: if the iframe hasn't fired `onLoad` within
 * `LOAD_TIMEOUT_MS`, we assume it's blocked and hide the card.
 *
 * "Hide on failure" is per the user's request: rather than showing a
 * broken/empty iframe shell, the surrounding message just renders the
 * link as plain text (the markdown link is unaffected).
 */
const LOAD_TIMEOUT_MS = 4500;

function EmbedCard({ embed }: { embed: MessageEmbedPreview }) {
  // null = loading, true = success, false = failed/hidden
  const [iframeStatus, setIframeStatus] = useState<null | boolean>(
    embed.iframe ? null : true,
  );
  const timeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!embed.iframe) return;
    if (iframeStatus !== null) return;
    // Conservative: if onLoad doesn't fire within the budget, assume
    // the iframe is being blocked (X-Frame-Options, CSP, network)
    // and remove the card. Browsers don't reliably fire onError for
    // cross-origin frames so this timeout is the only signal we get.
    timeoutRef.current = window.setTimeout(() => {
      setIframeStatus(false);
    }, LOAD_TIMEOUT_MS);
    return () => {
      if (timeoutRef.current !== null) {
        window.clearTimeout(timeoutRef.current);
        timeoutRef.current = null;
      }
    };
  }, [embed.iframe, iframeStatus]);

  // Hide the whole card if the iframe failed to load. The link itself
  // is still visible in the markdown body above, so the user can still
  // click through manually.
  if (embed.iframe && iframeStatus === false) {
    return null;
  }

  const handleLoad = () => {
    if (timeoutRef.current !== null) {
      window.clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
    setIframeStatus(true);
  };
  const handleError = () => {
    setIframeStatus(false);
  };

  return (
    <div
      // `max-w-full` is the responsive cap; the inline rule uses
      // CSS `min(native, 100%)` so the embed's declared natural
      // width acts as a CEILING but the container always shrinks
      // when the surrounding pane does. Previously the inline
      // `maxWidth: <native>` left the embed pinned at, say, 1280px,
      // so when the members panel opened and the message column
      // shrunk, the iframe overflowed instead of reflowing.
      className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_88%,transparent)] shadow-sm max-w-full"
      style={
        embed.iframe?.maxWidth
          ? { maxWidth: `min(${embed.iframe.maxWidth}, 100%)` }
          : undefined
      }
    >
      {embed.iframe ? (
        embed.iframe.fixedHeight ? (
          <div
            className="w-full bg-[var(--color-surface)]"
            style={{ height: embed.iframe.fixedHeight }}
          >
            <iframe
              src={embed.iframe.src}
              title={embed.iframe.title}
              loading="lazy"
              allow={embed.iframe.allow}
              sandbox={embed.iframe.sandbox}
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        ) : (
          <div className={`${getFrameClassName(embed.iframe.aspectRatio)} w-full bg-[var(--color-surface)]`}>
            <iframe
              src={embed.iframe.src}
              title={embed.iframe.title}
              loading="lazy"
              allow={embed.iframe.allow}
              sandbox={embed.iframe.sandbox}
              referrerPolicy="strict-origin-when-cross-origin"
              className="h-full w-full border-0"
              onLoad={handleLoad}
              onError={handleError}
            />
          </div>
        )
      ) : null}

      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-[0.12em] text-[var(--color-text-muted)]">
            {embed.provider}
          </div>
          <a
            href={embed.normalizedUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 block truncate text-sm font-medium text-[var(--color-info)] transition-colors hover:text-[var(--color-text)] hover:underline"
            title={embed.normalizedUrl}
          >
            {embed.displayText}
          </a>
        </div>
        <span className="shrink-0 rounded-full border border-[var(--color-border-secondary)] px-2 py-1 text-[10px] uppercase tracking-[0.12em] text-[var(--color-text-secondary)]">
          Link
        </span>
      </div>
    </div>
  );
}

export function MessageEmbeds({ content, className = "" }: MessageEmbedsProps) {
  // Only show cards for URLs that have an iframe preview. URLs from
  // platforms we can't iframe (arbitrary websites, X-Frame-Options-
  // blocked sources, etc.) are left as their plain markdown link in
  // the message body -- per the user's "if we can't load the iframe
  // don't show anything" requirement. EmbedCard further hides itself
  // if the iframe is configured but fails to load within the timeout.
  const embeds = extractMessageEmbeds(content).filter((e) => !!e.iframe);

  if (embeds.length === 0) {
    return null;
  }

  return (
    <div className={`mt-3 space-y-3 ${className}`}>
      {embeds.map((embed) => (
        <EmbedCard key={embed.normalizedUrl} embed={embed} />
      ))}
    </div>
  );
}

export default MessageEmbeds;
