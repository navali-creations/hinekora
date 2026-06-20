import { MarkdownRenderer } from "~/renderer/components/MarkdownRenderer/MarkdownRenderer";

interface ChangelogContentProps {
  content: string;
}

function ChangelogContent({ content }: ChangelogContentProps) {
  if (!content.trim()) {
    return null;
  }

  return <MarkdownRenderer className="mt-3">{content}</MarkdownRenderer>;
}

export default ChangelogContent;
