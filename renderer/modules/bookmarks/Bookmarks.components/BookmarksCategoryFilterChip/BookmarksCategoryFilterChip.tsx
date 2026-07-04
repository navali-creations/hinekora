import clsx from "clsx";

import type { BookmarkCategory } from "~/main/modules/bookmarks";
import {
  allBookmarkCategoriesValue,
  bookmarkCategoryChipClassNames,
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
  let chipClassName: string;
  if (isAllCategory) {
    chipClassName = isActive
      ? "border-primary/70 bg-primary/15 text-primary"
      : "border-base-content/10 bg-base-300 text-base-content/55 hover:border-primary/50 hover:bg-primary/10 hover:text-primary";
  } else {
    chipClassName =
      bookmarkCategoryChipClassNames[category][isActive ? "selected" : "idle"];
  }

  const handleSelect = () => {
    onSelect(category);
  };

  return (
    <button
      className={clsx(
        "inline-flex h-6 cursor-pointer items-center rounded-md border px-2 font-medium text-xs transition-colors",
        chipClassName,
        isActive ? "shadow-sm" : "opacity-80 hover:opacity-100",
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
