import type {
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";
import type { BookmarksCategoryFilterValue } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksCategoryFilterChip/BookmarksCategoryFilterChip";
import { allBookmarkCategoriesValue } from "~/renderer/modules/bookmarks/Bookmarks.utils";

const allRecordingBookmarkCategoriesValue = allBookmarkCategoriesValue;
const recordingBookmarksPanelPageSize = 5;

type RecordingBookmarkCategoryFilter = BookmarksCategoryFilterValue;

function resolveRecordingBookmarkCategories(
  bookmarks: RecordingBookmark[],
): BookmarkCategory[] {
  return Array.from(new Set(bookmarks.map((bookmark) => bookmark.category)));
}

export {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
  recordingBookmarksPanelPageSize,
  resolveRecordingBookmarkCategories,
};
