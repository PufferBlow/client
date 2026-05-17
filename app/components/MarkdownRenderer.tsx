import React, { useCallback, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

/**
 * Detect whether a markdown-embedded image URL is a GIF, by file
 * extension OR known GIF-host CDN paths. The old code only treated
 * giphy URLs as GIFs and rendered every other `.gif` link as a static
 * image -- which meant a user-uploaded `.gif`, a tenor.com link, or any
 * direct `cat.gif` link played without any pause behaviour and never
 * got the GIF badge.
 *
 * The check is generous on purpose: WebP / APNG can also be animated,
 * but we don't snapshot those here (the canvas-snapshot pass only
 * targets `.gif` reliably; APNG / animated WebP would need different
 * decode handling). Anything that doesn't match falls back to a plain
 * <img> render.
 */
function isGifUrl(url: string): boolean {
  if (!url) return false;
  const lower = url.toLowerCase();
  // Strip query + hash so a `cat.gif?v=2` still matches.
  const pathOnly = lower.split('?')[0].split('#')[0];
  if (pathOnly.endsWith('.gif')) return true;
  // Giphy / Tenor / Imgur direct gif endpoints. Each of these hosts a
  // GIF even when the URL doesn't carry an extension.
  if (lower.includes('giphy.com')) return true;
  if (lower.includes('media.tenor.com') || lower.includes('tenor.com/view')) return true;
  if (pathOnly.match(/imgur\.com\/.+\.gifv?$/)) return true;
  return false;
}

/**
 * GIF-aware image renderer used inside markdown.
 *
 * Two-stage behaviour matching AttachmentBubble's GIF flow:
 *   1. On mount the live <img> plays the GIF; after ~3 seconds (or
 *      when the canvas snapshot is ready, whichever is later) the src
 *      swaps to a static first-frame data URL so the animation freezes.
 *   2. On hover, the src swaps back to the live URL -- the GIF plays
 *      until the cursor leaves.
 *
 * The canvas-snapshot path can fail under CORS for cross-origin images
 * (`toDataURL` throws SecurityError). We catch and fall back to
 * letting the GIF animate normally -- not blocking but losing the
 * pause UX in those cases.
 */
function MarkdownImage({ src, alt, title }: { src: string; alt?: string; title?: string }) {
  const isGif = isGifUrl(src);
  const [frozenSrc, setFrozenSrc] = useState<string | null>(null);
  const [autoPlayDone, setAutoPlayDone] = useState(false);
  const [isHovered, setIsHovered] = useState(false);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const hiddenImgRef = useRef<HTMLImageElement | null>(null);

  // Capture the GIF's first frame to a canvas on initial decode.
  const captureFrame = useCallback(() => {
    if (!isGif || frozenSrc) return;
    const img = hiddenImgRef.current;
    if (!img || !img.complete || !img.naturalWidth) return;
    try {
      const maxW = 600;
      const scale = Math.min(1, maxW / img.naturalWidth);
      const w = Math.max(1, Math.round(img.naturalWidth * scale));
      const h = Math.max(1, Math.round(img.naturalHeight * scale));
      const canvas = document.createElement('canvas');
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0, w, h);
      setFrozenSrc(canvas.toDataURL('image/png'));
    } catch {
      // CORS-tainted canvas, etc. Leave the GIF animating.
    }
  }, [isGif, frozenSrc]);

  // After a short auto-play, freeze on the first frame.
  useEffect(() => {
    if (!isGif) return;
    const timer = window.setTimeout(() => setAutoPlayDone(true), 3000);
    return () => window.clearTimeout(timer);
  }, [isGif]);

  if (!isGif) {
    // Plain static image -- no canvas dance.
    return (
      <img
        src={src}
        alt={alt ?? ''}
        title={title}
        loading="lazy"
        className="my-1 max-h-96 max-w-full rounded-md object-contain"
      />
    );
  }

  // GIF mode: animated <img> shown until autoPlayDone + canvas ready;
  // after that we swap to the snapshot until hovered.
  const showAnimated = isHovered || !autoPlayDone || !frozenSrc;

  return (
    <span
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hidden image used solely to feed the canvas snapshot. */}
      <img
        ref={hiddenImgRef}
        src={src}
        alt=""
        aria-hidden="true"
        crossOrigin="anonymous"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        onLoad={captureFrame}
      />
      <img
        ref={imgRef}
        src={showAnimated ? src : frozenSrc!}
        alt={alt ?? ''}
        title={title}
        loading="lazy"
        className="my-1 max-h-96 max-w-full rounded-md object-contain"
      />
      {/* "GIF" badge while paused so it's clear the still frame can
          be unfrozen by hovering. Mirrors AttachmentBubble's badge. */}
      {autoPlayDone && frozenSrc && !isHovered && (
        <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/60 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
          GIF
        </span>
      )}
    </span>
  );
}


interface MarkdownRendererProps {
  content: string;
  className?: string;
  /** Set of lowercase usernames to highlight as @mentions. */
  mentionedUsernames?: ReadonlySet<string>;
}

/** Split a text string on @username tokens and return mixed text/mention JSX. */
function renderMentions(text: string, mentionedUsernames: ReadonlySet<string>): React.ReactNode {
  const parts = text.split(/(@[\w.-]+)/g);
  if (parts.length === 1) return text;
  return parts.map((part, i) => {
    if (part.startsWith('@') && mentionedUsernames.has(part.slice(1).toLowerCase())) {
      return (
        <span
          key={i}
          className="mention rounded bg-[var(--color-primary)]/15 px-0.5 font-semibold text-[var(--color-primary)] hover:bg-[var(--color-primary)]/25"
        >
          {part}
        </span>
      );
    }
    return part;
  });
}

/** Recursively process React children, highlighting @mentions in string nodes. */
function processChildren(
  children: React.ReactNode,
  mentionedUsernames: ReadonlySet<string>,
): React.ReactNode {
  return React.Children.map(children, (child) => {
    if (typeof child === 'string') return renderMentions(child, mentionedUsernames);
    if (React.isValidElement(child)) {
      const el = child as React.ReactElement<{ children?: React.ReactNode }>;
      if (el.props.children) {
        return React.cloneElement(el, {
          children: processChildren(el.props.children, mentionedUsernames),
        } as Partial<typeof el.props>);
      }
    }
    return child;
  });
}

function extractTextContent(node: React.ReactNode): string {
  if (typeof node === 'string' || typeof node === 'number') {
    return String(node);
  }

  if (Array.isArray(node)) {
    return node.map(extractTextContent).join('');
  }

  if (React.isValidElement(node)) {
    const element = node as React.ReactElement<{ children?: React.ReactNode }>;
    return extractTextContent(element.props.children);
  }

  return '';
}

export function MarkdownRenderer({ content, className = "", mentionedUsernames }: MarkdownRendererProps) {
  // External-link confirmation. Clicking a link that leaves Pufferblow
  // routes through a confirmation dialog rather than opening blindly --
  // protects against phishing / drive-by redirects from message
  // content. Same-origin / hash anchors bypass the dialog (they're
  // "inside" the app). State is local to each MarkdownRenderer instance
  // since there can be many messages but at most one link click at a
  // time has the dialog open.
  const [pendingHref, setPendingHref] = useState<string | null>(null);
  const closePending = () => setPendingHref(null);
  const openPending = () => {
    if (!pendingHref) return;
    // The window.open call must happen synchronously inside the click
    // handler that triggered the dialog OR via a user-initiated
    // gesture; since the dialog's Open button is itself a click, we're
    // good. `noopener,noreferrer` matches the safer `target=_blank`
    // semantics the old code already used.
    window.open(pendingHref, "_blank", "noopener,noreferrer");
    closePending();
  };
  // Plain boolean (not a type guard) so the `if (!external)` branch
  // doesn't narrow `href` to never -- a non-external href can still
  // be a string (mailto:, /relative, same-origin URL, etc.).
  const isExternalHref = (href: string | undefined): boolean => {
    if (!href) return false;
    if (href.startsWith("#")) return false; // hash anchor
    if (href.startsWith("/")) return false; // relative-root, in-app
    if (href.startsWith("mailto:") || href.startsWith("tel:")) return false;
    if (typeof window !== "undefined") {
      try {
        const u = new URL(href, window.location.href);
        if (u.origin === window.location.origin) return false; // same-origin
      } catch {
        // Invalid URL -- treat as internal so we don't break the click
        return false;
      }
    }
    return true;
  };
  const CodeBlock = ({
    className,
    children,
    text,
    language,
  }: {
    className?: string;
    children: React.ReactNode;
    text: string;
    language: string;
  }) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1800);
      } catch {
        setCopied(false);
      }
    };

    const normalizedCodeClassName = `hljs ${className || ''}`.trim();

    return (
      <div className="relative my-4 overflow-hidden rounded-lg border border-[var(--color-border)] bg-[var(--color-background-tertiary)]">
        {/* Language label */}
        <div className="absolute left-3 top-2 z-10 rounded border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1 font-mono text-xs text-[var(--color-text-muted)]">
          {language}
        </div>

        {/* Copy button */}
        <button
          onClick={handleCopy}
          className="absolute right-2 top-2 z-10 rounded border border-[var(--color-border-secondary)] bg-[var(--color-background-secondary)] px-2 py-1 text-xs text-[var(--color-text-secondary)] transition-colors duration-200 hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
          title="Copy code"
          type="button"
          aria-label="Copy code block"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>

        {/* Code block container */}
        <pre className="overflow-x-auto px-4 pb-4 pt-10 text-sm leading-relaxed">
          <code className={`${normalizedCodeClassName} block`}>
            {children}
          </code>
        </pre>
      </div>
    );
  };

  return (
    // `select-text` is intentional: the DashboardPage root applies
    // `select-none` to lock the chat UI chrome (avatars, channel rows,
    // etc.) from being accidentally selected on click-drag. Message
    // bodies need to opt back in so the user can highlight + copy any
    // part of what someone said. This is the single override; all
    // markdown-rendered content (only chat messages today) inherits it.
    <div className={`pb-markdown break-words overflow-wrap-anywhere select-text ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Paragraphs — highlight @mentions inside text nodes
          p: ({ children }) => (
            <p>
              {mentionedUsernames && mentionedUsernames.size > 0
                ? processChildren(children, mentionedUsernames)
                : children}
            </p>
          ),
          // GIF-aware image renderer. Any `.gif` URL (or known GIF-host
          // CDN like giphy/tenor) gets first-frame freeze + hover-to-play;
          // other images render statically. Previously the default <img>
          // played every embedded image, with no special handling for
          // GIFs except those routed through the Giphy picker.
          img: ({ src, alt, title }) => (
            <MarkdownImage
              src={typeof src === 'string' ? src : ''}
              alt={alt}
              title={typeof title === 'string' ? title : undefined}
            />
          ),
          // Custom link component. External links route through the
          // confirmation dialog (see `pendingHref` state above); same-
          // origin / hash / mailto: / tel: open immediately.
          a: ({ href, children }) => {
            const external = isExternalHref(href);
            if (!external) {
              return (
                <a
                  href={href}
                  target={href?.startsWith("#") ? "_self" : "_blank"}
                  rel={href?.startsWith("#") ? undefined : "noopener noreferrer"}
                  className="text-[var(--color-info)] hover:text-[var(--color-text)] hover:underline"
                >
                  {children}
                </a>
              );
            }
            return (
              <a
                href={href}
                onClick={(e) => {
                  e.preventDefault();
                  setPendingHref(href || "");
                }}
                className="text-[var(--color-info)] hover:text-[var(--color-text)] hover:underline"
                // Right-click → "Copy link address" still works; the
                // confirmation only intercepts left-click activation.
              >
                {children}
              </a>
            );
          },
          // Custom code blocks
          code: ({ className, children, ...props }) => {
            const normalizedClass = className || '';
            const languageMatch = /language-([\w-]+)/.exec(normalizedClass);
            const codeText = extractTextContent(children).replace(/\n$/, '');
            const isBlock =
              Boolean(languageMatch) ||
              normalizedClass.includes('hljs') ||
              codeText.includes('\n');

            return isBlock ? (
              <CodeBlock
                className={normalizedClass}
                text={codeText}
                language={languageMatch?.[1] || 'text'}
              >
                {children}
              </CodeBlock>
            ) : (
              <code className="rounded border border-[var(--color-border-secondary)] bg-[var(--color-surface-tertiary)] px-1 py-0.5 text-sm text-[var(--color-text-secondary)]" {...props}>
                {children}
              </code>
            );
          },
          // Custom headings
          h1: ({ children }) => <h1 className="mb-2 mt-4 text-xl font-bold text-[var(--color-text)]">{children}</h1>,
          h2: ({ children }) => <h2 className="mb-2 mt-3 text-lg font-bold text-[var(--color-text)]">{children}</h2>,
          h3: ({ children }) => <h3 className="mb-1 mt-2 text-base font-bold text-[var(--color-text-secondary)]">{children}</h3>,
          // Emphasized text
          strong: ({ children }) => <strong className="font-bold text-[var(--color-text)]">{children}</strong>,
          em: ({ children }) => <em className="italic text-[var(--color-text-secondary)]">{children}</em>,
          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside ml-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside ml-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-[var(--color-text-secondary)]">{children}</li>,
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-[var(--color-border-secondary)] pl-4 italic text-[var(--color-text-secondary)]">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-[var(--color-border-secondary)]">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-[var(--color-surface-tertiary)]">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-[var(--color-border-secondary)]">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2 text-left font-semibold text-[var(--color-text)]">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 text-[var(--color-text-secondary)]">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>

      {/* External-link confirmation. Rendered as a sibling of the
          markdown body so its z-index isn't trapped under the message
          row's clipping/overflow. Clicking the backdrop or Cancel
          dismisses; Open spawns the external tab and dismisses. */}
      {pendingHref && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Open external link"
          className="fixed inset-0 z-[90] flex items-center justify-center bg-black/55 p-4"
          onClick={closePending}
        >
          <div
            className="w-full max-w-md rounded-xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-[var(--color-border)]">
              <h3 className="text-base font-semibold text-[var(--color-text)]">
                You're leaving Pufferblow
              </h3>
              <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
                This link opens an external site in your browser. Only continue if
                you trust the source.
              </p>
            </div>
            <div className="px-5 py-4">
              <div className="text-[10px] uppercase tracking-wide text-[var(--color-text-muted)]">
                Destination
              </div>
              <div
                className="mt-1 break-all rounded-md border border-[var(--color-border-secondary)] bg-[var(--color-surface-secondary)] px-3 py-2 font-mono text-xs text-[var(--color-text)]"
                title={pendingHref}
              >
                {pendingHref}
              </div>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-[var(--color-border)] px-5 py-3">
              <button
                type="button"
                onClick={closePending}
                className="rounded-md px-3 py-1.5 text-sm text-[var(--color-text-secondary)] transition-colors hover:bg-[var(--color-hover)] hover:text-[var(--color-text)]"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={openPending}
                className="rounded-md bg-[var(--color-primary)] px-3 py-1.5 text-sm font-medium text-[var(--color-on-primary)] transition-colors hover:bg-[var(--color-primary-hover)]"
              >
                Open link
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
