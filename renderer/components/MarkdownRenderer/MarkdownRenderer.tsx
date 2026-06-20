import type { Components } from "react-markdown";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const components: Components = {
  h1: (props) => (
    <h1 className="mb-2 mt-4 text-lg font-bold text-base-content" {...props} />
  ),
  h2: (props) => (
    <h2
      className="mb-2 mt-3 text-base font-semibold text-base-content"
      {...props}
    />
  ),
  h3: (props) => (
    <h3
      className="mb-1.5 mt-3 text-sm font-semibold text-base-content/90"
      {...props}
    />
  ),
  h4: (props) => (
    <h4
      className="mb-1 mt-2 text-sm font-semibold text-base-content/90"
      {...props}
    />
  ),
  p: (props) => (
    <p
      className="mb-2 text-sm leading-relaxed text-base-content/80"
      {...props}
    />
  ),
  a: (props) => (
    <a
      className="text-primary hover:underline"
      target="_blank"
      rel="noopener noreferrer"
      {...props}
    />
  ),
  ul: (props) => <ul className="mb-2 ml-1 space-y-1.5" {...props} />,
  ol: (props) => (
    <ol className="mb-2 ml-1 list-inside list-decimal space-y-1.5" {...props} />
  ),
  li: ({ children, ...props }) => (
    <li
      className="flex items-start gap-2 text-sm text-base-content/80"
      {...props}
    >
      <span className="mt-1 shrink-0 text-primary">-</span>
      <span>{children}</span>
    </li>
  ),
  img: ({ width, style, ...props }) => {
    const numericWidth =
      typeof width === "string" || typeof width === "number"
        ? Number(width)
        : undefined;
    const maxWidth = Number.isFinite(numericWidth)
      ? `min(${numericWidth}px, 100%)`
      : "100%";

    return (
      <img
        className="my-2 h-auto max-w-full rounded-lg border border-base-content/10"
        loading="lazy"
        style={{ ...style, maxWidth }}
        width={width}
        {...props}
      />
    );
  },
  hr: (props) => <hr className="my-3 border-base-content/10" {...props} />,
  code: ({ className, ...props }) =>
    className ? (
      <code
        className="block overflow-x-auto rounded-lg bg-base-300 p-3 font-mono text-xs text-base-content/90"
        {...props}
      />
    ) : (
      <code
        className="rounded bg-base-300 px-1.5 py-0.5 font-mono text-xs text-base-content/90"
        {...props}
      />
    ),
  pre: (props) => (
    <pre
      className="my-2 overflow-x-auto rounded-lg bg-base-300 p-3 font-mono text-xs"
      {...props}
    />
  ),
  blockquote: (props) => (
    <blockquote
      className="my-2 border-primary/40 border-l-2 pl-3 text-sm text-base-content/60 italic"
      {...props}
    />
  ),
  strong: (props) => (
    <strong className="font-semibold text-base-content/90" {...props} />
  ),
  em: (props) => <em className="italic" {...props} />,
  table: (props) => (
    <div className="my-3 overflow-x-auto">
      <table
        className="table table-sm w-full rounded-lg border border-base-content/10 text-sm"
        {...props}
      />
    </div>
  ),
  thead: (props) => (
    <thead className="bg-base-200 text-base-content/90" {...props} />
  ),
  tr: (props) => <tr className="border-base-content/10 border-b" {...props} />,
  th: (props) => (
    <th
      className="px-3 py-2 text-left font-semibold text-base-content/80 text-xs uppercase"
      {...props}
    />
  ),
  td: (props) => (
    <td className="px-3 py-2 text-sm text-base-content/80" {...props} />
  ),
};

interface MarkdownRendererProps {
  children: string;
  className?: string;
  componentOverrides?: Partial<Components>;
}

function MarkdownRenderer({
  children,
  className,
  componentOverrides,
}: MarkdownRendererProps) {
  const mergedComponents = componentOverrides
    ? { ...components, ...componentOverrides }
    : components;

  return (
    <div className={className}>
      <ReactMarkdown components={mergedComponents} remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}

export { MarkdownRenderer };
