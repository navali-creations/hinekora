import clsx from "clsx";

import type { BookmarkCategory } from "~/main/modules/bookmarks";
import {
  allBookmarkCategoriesValue,
  bookmarkCategoryBadgeClassNames,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

type BookmarksCategoryFilterValue =
  | BookmarkCategory
  | typeof allBookmarkCategoriesValue;

interface BookmarksCategoryFilterChipProps {
  category: BookmarksCategoryFilterValue;
  isActive: boolean;
  onSelect: (category: BookmarksCategoryFilterValue) => void;
}

function BookmarksCategoryFilterChip({
  category,
  isActive,
  onSelect,
}: BookmarksCategoryFilterChipProps) {
  const isAllCategory = category === allBookmarkCategoriesValue;
  const label = isAllCategory ? "All" : bookmarkCategoryLabels[category];
  const badgeClassName = isAllCategory
    ? "badge-neutral"
    : bookmarkCategoryBadgeClassNames[category];

  const handleSelect = () => {
    onSelect(category);
  };

  return (
    <button
      className={clsx(
        "badge badge-sm cursor-pointer border-base-content/10",
        badgeClassName,
        isActive ? "ring-2 ring-primary/50" : "opacity-70 hover:opacity-100",
      )}
      type="button"
      onClick={handleSelect}
    >
      {label}
    </button>
  );
}

export type { BookmarksCategoryFilterValue };
export { BookmarksCategoryFilterChip };
