import clsx from "clsx";

import {
  bookmarkCategoryBadgeClassNames,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
} from "../RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

interface RecordingBookmarkFilterChipProps {
  category: RecordingBookmarkCategoryFilter;
  isActive: boolean;
  onSelect: (category: RecordingBookmarkCategoryFilter) => void;
}

function RecordingBookmarkFilterChip({
  category,
  isActive,
  onSelect,
}: RecordingBookmarkFilterChipProps) {
  const isAllCategory = category === allRecordingBookmarkCategoriesValue;
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

export { RecordingBookmarkFilterChip };
