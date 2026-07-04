import type { BookmarkTableSeparator } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksTable/BookmarksTable.utils";

const bookmarkTableSeparatorStyle = {
  backgroundImage:
    "repeating-linear-gradient(135deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 8px)",
};

interface BookmarksTableSeparatorProps {
  separator: BookmarkTableSeparator;
}

function BookmarksTableSeparator({ separator }: BookmarksTableSeparatorProps) {
  return (
    <div
      className="flex min-h-10 flex-col items-center justify-center gap-0.5 text-[10px] text-base-content/50 leading-none"
      style={bookmarkTableSeparatorStyle}
    >
      <span>Start of new {separator.nextLabel}</span>
      <span className="h-px w-24 bg-base-content/20" />
      <span>End of previous {separator.previousLabel}</span>
    </div>
  );
}

export { BookmarksTableSeparator };
