import clsx from "clsx";

import {
  allBookmarkCategoriesValue,
  type BookmarkCategoryFilterValue,
  bookmarkCategoryChipClassNames,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

interface BookmarksCategoryFilterChipProps {
  category: BookmarkCategoryFilterValue;
  isActive: boolean;
  onSelect: (category: BookmarkCategoryFilterValue) => void;
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
      aria-pressed={isActive}
      className={clsx(
        "inline-flex h-6 cursor-pointer items-center rounded-md border px-2 font-medium text-xs transition-colors",
        chipClassName,
        isActive ? "shadow-sm" : "opacity-80 hover:opacity-100",
      )}
      data-bookmark-category-chip={category}
      type="button"
      onClick={handleSelect}
    >
      {label}
    </button>
  );
}

export type { BookmarkCategoryFilterValue as BookmarksCategoryFilterValue };
export { BookmarksCategoryFilterChip };
