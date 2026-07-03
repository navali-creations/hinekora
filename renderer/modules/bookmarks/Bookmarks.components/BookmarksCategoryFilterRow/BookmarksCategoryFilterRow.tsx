import type { BookmarkCategory } from "~/main/modules/bookmarks";
import { allBookmarkCategoriesValue } from "~/renderer/modules/bookmarks/Bookmarks.utils";

import {
  BookmarksCategoryFilterChip,
  type BookmarksCategoryFilterValue,
} from "../BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";

interface BookmarksCategoryFilterRowProps {
  categories: BookmarkCategory[];
  selectedCategory: BookmarksCategoryFilterValue;
  onSelectCategory: (category: BookmarksCategoryFilterValue) => void;
}

function BookmarksCategoryFilterRow({
  categories,
  selectedCategory,
  onSelectCategory,
}: BookmarksCategoryFilterRowProps) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <BookmarksCategoryFilterChip
        category={allBookmarkCategoriesValue}
        isActive={selectedCategory === allBookmarkCategoriesValue}
        onSelect={onSelectCategory}
      />
      {categories.map((category) => (
        <BookmarksCategoryFilterChip
          category={category}
          isActive={selectedCategory === category}
          key={category}
          onSelect={onSelectCategory}
        />
      ))}
    </div>
  );
}

export { BookmarksCategoryFilterRow };
