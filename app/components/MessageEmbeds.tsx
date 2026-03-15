import { extractMessageEmbeds } from "../utils/messageEmbeds";

interface MessageEmbedsProps {
  content: string;
  className?: string;
}

export function MessageEmbeds({ content, className = "" }: MessageEmbedsProps) {
  const embeds = extractMessageEmbeds(content);

  if (embeds.length === 0) {
    return null;
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

  return (
    <div className={`mt-3 space-y-3 ${className}`}>
      {embeds.map((embed) => (
        <div
          key={embed.normalizedUrl}
          className="overflow-hidden rounded-xl border border-[var(--color-border)] bg-[color:color-mix(in_srgb,var(--color-surface-secondary)_88%,transparent)] shadow-sm"
          style={embed.iframe?.maxWidth ? { maxWidth: embed.iframe.maxWidth } : undefined}
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
      ))}
    </div>
  );
}

export default MessageEmbeds;
