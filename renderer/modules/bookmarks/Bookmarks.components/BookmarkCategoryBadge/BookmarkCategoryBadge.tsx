import clsx from "clsx";

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
  size?: "sm" | "xs";
  subcategory: BookmarkSubcategory;
}

function BookmarkCategoryBadge({
  category,
  size = "sm",
  subcategory,
}: BookmarkCategoryBadgeProps) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className={clsx(
          "badge",
          size === "xs" ? "badge-xs" : "badge-sm",
          bookmarkCategoryBadgeClassNames[category],
        )}
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
