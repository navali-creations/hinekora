import type {
  BookmarkCategory,
  BookmarkSubcategory,
} from "~/main/modules/bookmarks";
import {
  bookmarkCategoryBadgeClassNames,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

interface BookmarkCategoryBadgeProps {
  category: BookmarkCategory;
  subcategory: BookmarkSubcategory;
}

function BookmarkCategoryBadge({
  category,
  subcategory,
}: BookmarkCategoryBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={`badge badge-sm ${bookmarkCategoryBadgeClassNames[category]}`}
      >
        {bookmarkCategoryLabels[category]}
      </span>
      {subcategory && (
        <span className="text-base-content/50 text-xs">{subcategory}</span>
      )}
    </div>
  );
}

export { BookmarkCategoryBadge };
