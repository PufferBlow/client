import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className = "" }: MarkdownRendererProps) {
  const CodeBlock = ({ className, children, text }: any) => {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    };

    return (
      <div className="relative">
        <button
          onClick={handleCopy}
          className="absolute top-2 right-2 bg-gray-600 hover:bg-gray-500 text-white text-xs px-2 py-1 rounded"
          title="Copy code"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <pre className="bg-gray-700 rounded px-3 py-2 overflow-x-auto text-sm">
          <code className={className}>
            {children}
          </code>
        </pre>
      </div>
    );
  };

  return (
    <div className={`break-words overflow-wrap-anywhere ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeHighlight]}
        components={{
          // Custom link component to open links in new tab safely
          a: ({ href, children }) => {
            const isInternal = href?.startsWith('#');
            return (
              <a
                href={href}
                target={isInternal ? '_self' : '_blank'}
                rel={isInternal ? undefined : 'noopener noreferrer'}
                className="text-blue-400 hover:text-blue-300 hover:underline"
              >
                {children}
              </a>
            );
          },
          // Custom code blocks
          code: ({ className, children, ...props }) => {
            const isInline = !className?.startsWith('language-');
            const text = React.Children.toArray(children).join('');
            return !isInline ? (
              <CodeBlock className={className} text={text}>
                {children}
              </CodeBlock>
            ) : (
              <code className="bg-gray-700 text-red-300 px-1 py-0.5 rounded text-sm" {...props}>
                {children}
              </code>
            );
          },
          // Custom headings
          h1: ({ children }) => <h1 className="text-xl font-bold mb-2 mt-4 text-gray-200">{children}</h1>,
          h2: ({ children }) => <h2 className="text-lg font-bold mb-2 mt-3 text-gray-200">{children}</h2>,
          h3: ({ children }) => <h3 className="text-base font-bold mb-1 mt-2 text-gray-300">{children}</h3>,
          // Emphasized text
          strong: ({ children }) => <strong className="font-bold text-gray-100">{children}</strong>,
          em: ({ children }) => <em className="italic text-gray-300">{children}</em>,
          // Lists
          ul: ({ children }) => <ul className="list-disc list-inside ml-4 space-y-1">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside ml-4 space-y-1">{children}</ol>,
          li: ({ children }) => <li className="text-gray-300">{children}</li>,
          // Blockquotes
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-gray-500 pl-4 italic text-gray-400">
              {children}
            </blockquote>
          ),
          // Tables
          table: ({ children }) => (
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-600">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-gray-700">{children}</thead>,
          tbody: ({ children }) => <tbody>{children}</tbody>,
          tr: ({ children }) => <tr className="border-b border-gray-600">{children}</tr>,
          th: ({ children }) => <th className="px-4 py-2 text-left text-gray-200 font-semibold">{children}</th>,
          td: ({ children }) => <td className="px-4 py-2 text-gray-300">{children}</td>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
