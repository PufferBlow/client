import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';


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
    <div className={`pb-markdown break-words overflow-wrap-anywhere ${className}`}>
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
          // Custom link component to open links in new tab safely
          a: ({ href, children }) => {
            const isInternal = href?.startsWith('#');
            return (
              <a
                href={href}
                target={isInternal ? '_self' : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className="text-[var(--color-info)] hover:text-[var(--color-text)] hover:underline"
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
    </div>
  );
}
