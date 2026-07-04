import type {
  BookmarkCategory,
  BookmarkSource,
} from "~/main/modules/bookmarks";

const allBookmarkCategoriesValue = "__all__";

const bookmarkCategoryLabels: Record<BookmarkCategory, string> = {
  boss: "Boss",
  death: "Death",
  hideout: "Hideout",
  manual: "Manual",
  map: "Map",
  pinnacle: "Pinnacle",
  "rewind-manual-replay": "Manual replay",
  town: "Town",
};

const bookmarkCategoryBadgeClassNames: Record<BookmarkCategory, string> = {
  boss: "border-orange-500 bg-orange-500 text-black",
  death: "badge-error",
  hideout: "badge-info",
  manual: "badge-primary",
  map: "badge-success",
  pinnacle: "badge-warning",
  "rewind-manual-replay": "badge-secondary",
  town: "badge-neutral",
};

const bookmarkCategoryTimelineClassNames: Record<BookmarkCategory, string> = {
  boss: "bg-orange-500",
  death: "bg-red-600",
  hideout: "bg-sky-500",
  manual: "bg-purple-400",
  map: "bg-emerald-500",
  pinnacle: "bg-amber-400",
  "rewind-manual-replay": "bg-purple-400",
  town: "bg-zinc-400",
};

const bookmarkSourceLabels: Record<BookmarkSource, string> = {
  "client-log": "Client-Log",
  manual: "Manual",
  system: "System",
};

export {
  allBookmarkCategoriesValue,
  bookmarkCategoryBadgeClassNames,
  bookmarkCategoryLabels,
  bookmarkCategoryTimelineClassNames,
  bookmarkSourceLabels,
};
