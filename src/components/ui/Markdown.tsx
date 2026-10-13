import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from "react";
import { Check, Copy } from "lucide-react";
import type { Block, Inline } from "../../lib/markdown";
import { copyToClipboard } from "../../lib/clipboard";
import { EmojiText } from "./Emoji";

/**
 * Renders parsed message Markdown (see `lib/markdown`) as React elements. `trailing` is put at
 * the end of the last block when it holds text, e.g. the "(edited)" marker.
 */
export function Markdown({ blocks, trailing }: { blocks: Block[]; trailing?: ReactNode }) {
  const last = blocks.length - 1;
  const lastType = blocks[last]?.type;
  const trailingFitsInLast = lastType !== undefined && lastType !== "codeblock" && lastType !== "quote" && lastType !== "list";
  return (
    <>
      {blocks.map((block, i) => (
        <BlockView key={i} block={block} trailing={i === last && trailingFitsInLast ? trailing : undefined} />
      ))}
      {!trailingFitsInLast && trailing}
    </>
  );
}

const HEADINGS = {
  1: { Tag: "h1", size: "text-[22px]" },
  2: { Tag: "h2", size: "text-[19px]" },
  3: { Tag: "h3", size: "text-[16.5px]" },
} as const;

function BlockView({ block, trailing }: { block: Block; trailing?: ReactNode }) {
  switch (block.type) {
    case "paragraph":
      return (
        <p className="m-0">
          <Inlines nodes={block.children} />
          {trailing}
        </p>
      );
    case "heading": {
      const { Tag, size } = HEADINGS[block.level];
      return (
        <Tag className={`mb-0.5 mt-2 font-bold leading-snug text-text first:mt-0 ${size}`}>
          <Inlines nodes={block.children} />
          {trailing}
        </Tag>
      );
    }
    case "subtext":
      return (
        <p className="m-0 text-[12.5px] text-text-muted">
          <Inlines nodes={block.children} />
          {trailing}
        </p>
      );
    case "quote":
      return (
        <blockquote className="m-0 my-0.5 border-l-[3px] border-border pl-3">
          {block.children.map((child, i) => (
            <BlockView key={i} block={child} />
          ))}
        </blockquote>
      );
    case "list": {
      const items = block.items.map((item, i) => (
        <li key={i}>
          <Inlines nodes={item} />
        </li>
      ));
      return block.ordered ? (
        <ol start={block.start} className="m-0 list-decimal pl-6 marker:text-text-muted">
          {items}
        </ol>
      ) : (
        <ul className="m-0 list-disc pl-6 marker:text-text-muted">{items}</ul>
      );
    }
    case "codeblock":
      return <CodeBlock lang={block.lang} value={block.value} />;
  }
}

function Inlines({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((node, i) => (
        <InlineView key={i} node={node} />
      ))}
    </>
  );
}

function InlineView({ node }: { node: Inline }) {
  switch (node.type) {
    case "text":
      return <EmojiText text={node.value} />;
    case "code":
      return (
        <code className="rounded-[5px] border border-border-secondary bg-background-secondary px-[0.3em] py-[0.1em] font-mono text-[0.85em] text-text">
          {node.value}
        </code>
      );
    case "strong":
      return (
        <strong className="font-bold text-text">
          <Inlines nodes={node.children} />
        </strong>
      );
    case "em":
      return (
        <em>
          <Inlines nodes={node.children} />
        </em>
      );
    case "underline":
      return (
        <span className="underline underline-offset-2">
          <Inlines nodes={node.children} />
        </span>
      );
    case "strike":
      return (
        <s>
          <Inlines nodes={node.children} />
        </s>
      );
    case "spoiler":
      return (
        <Spoiler>
          <Inlines nodes={node.children} />
        </Spoiler>
      );
    case "link": {
      const masked = !node.embed;
      return (
        <a
          href={node.href}
          target="_blank"
          rel="noreferrer noopener"
          title={masked ? node.href : undefined}
          className="text-info underline-offset-2 hover:underline"
        >
          <Inlines nodes={node.children} />
        </a>
      );
    }
  }
}

/** Hidden behind a dark bar until clicked (or Enter/Space), then stays revealed. */
export function Spoiler({ children }: { children: ReactNode }) {
  const [revealed, setRevealed] = useState(false);
  if (revealed) return <span className="rounded-[4px] bg-text/[0.08] px-[2px]">{children}</span>;

  const reveal = (e: MouseEvent | KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setRevealed(true);
  };
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Spoiler, select to reveal"
      onClick={reveal}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && reveal(e)}
      className="cursor-pointer select-none rounded-[4px] bg-[#050403] px-[2px] transition-colors hover:bg-[#120f0c] focus-visible:outline-2 focus-visible:outline-primary"
    >
      {/* Keeps its size but can't be seen, clicked or read out until revealed. */}
      <span aria-hidden="true" className="invisible">
        {children}
      </span>
    </span>
  );
}

function CodeBlock({ lang, value }: { lang: string | null; value: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    if (await copyToClipboard(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    }
  };
  return (
    <div className="group/code relative my-1 max-w-[min(100%,720px)]">
      <pre className="m-0 overflow-x-auto whitespace-pre rounded-lg border border-border-secondary bg-background-secondary px-3 py-2.5 font-mono text-[13px] leading-relaxed text-text-secondary">
        {lang && <span className="mb-1 block select-none font-sans text-[11px] font-semibold uppercase tracking-wider text-text-muted">{lang}</span>}
        <code>{value}</code>
      </pre>
      <button
        type="button"
        aria-label={copied ? "Copied" : "Copy code"}
        onClick={() => void copy()}
        className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-md border border-border-secondary bg-surface-secondary text-text-tertiary opacity-0 transition-opacity hover:text-text focus-visible:opacity-100 group-hover/code:opacity-100"
      >
        {copied ? <Check size={14} className="text-success" /> : <Copy size={14} />}
      </button>
    </div>
  );
}
