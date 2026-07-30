import type {
  BookmarkCategory,
  BookmarkCategoryCount,
} from "~/main/modules/bookmarks";
import {
  allBookmarkCategoriesValue,
  resolveBookmarkCategoryCountState,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  BookmarksCategoryFilterChip,
  type BookmarksCategoryFilterValue,
} from "../BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";

interface BookmarksCategoryFilterRowProps {
  categories: BookmarkCategory[];
  categoryCounts: BookmarkCategoryCount[];
  selectedCategory: BookmarksCategoryFilterValue;
  onSelectCategory: (category: BookmarksCategoryFilterValue) => void;
}

function BookmarksCategoryFilterRow({
  categories,
  categoryCounts,
  selectedCategory,
  onSelectCategory,
}: BookmarksCategoryFilterRowProps) {
  const { allCount, countsByCategory } =
    resolveBookmarkCategoryCountState(categoryCounts);

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <BookmarksCategoryFilterChip
        category={allBookmarkCategoriesValue}
        count={allCount}
        isActive={selectedCategory === allBookmarkCategoriesValue}
        onSelect={onSelectCategory}
      />
      {categories.map((category) => (
        <BookmarksCategoryFilterChip
          category={category}
          count={countsByCategory.get(category) ?? 0}
          isActive={selectedCategory === category}
          key={category}
          onSelect={onSelectCategory}
        />
      ))}
    </div>
  );
}

export { BookmarksCategoryFilterRow };
