import type { BookmarkCategory } from "~/main/modules/bookmarks";

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

const bookmarkCategoryTimelineLineClassNames: Record<BookmarkCategory, string> =
  {
    boss: "bg-gradient-to-b from-orange-500 to-primary",
    death: "bg-gradient-to-b from-red-600 to-primary",
    hideout: "bg-gradient-to-b from-sky-500 to-primary",
    manual: "bg-gradient-to-b from-purple-400 to-primary",
    map: "bg-gradient-to-b from-emerald-500 to-primary",
    pinnacle: "bg-gradient-to-b from-amber-400 to-primary",
    "rewind-manual-replay": "bg-gradient-to-b from-purple-400 to-primary",
    town: "bg-gradient-to-b from-zinc-400 to-primary",
  };

const bookmarkCategoryTimelineThumbClassNames: Record<
  BookmarkCategory,
  string
> = {
  boss: "border-orange-400/70 bg-orange-950",
  death: "border-red-500/70 bg-red-950",
  hideout: "border-sky-400/70 bg-sky-950",
  manual: "border-purple-300/70 bg-purple-950",
  map: "border-emerald-400/70 bg-emerald-950",
  pinnacle: "border-amber-300/70 bg-amber-950",
  "rewind-manual-replay": "border-purple-300/70 bg-purple-950",
  town: "border-zinc-300/70 bg-zinc-800",
};

const bookmarkCategoryIconClassNames: Record<BookmarkCategory, string> = {
  boss: "text-orange-400",
  death: "text-red-500",
  hideout: "text-sky-400",
  manual: "text-purple-300",
  map: "text-emerald-400",
  pinnacle: "text-amber-300",
  "rewind-manual-replay": "text-purple-300",
  town: "text-zinc-300",
};

const bookmarkCategoryRowClassNames: Record<BookmarkCategory, string> = {
  boss: "bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent",
  death: "bg-gradient-to-r from-red-600/15 via-red-600/5 to-transparent",
  hideout: "bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent",
  manual: "bg-gradient-to-r from-purple-400/15 via-purple-400/5 to-transparent",
  map: "bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent",
  pinnacle: "bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent",
  "rewind-manual-replay":
    "bg-gradient-to-r from-purple-400/15 via-purple-400/5 to-transparent",
  town: "bg-gradient-to-r from-zinc-400/15 via-zinc-400/5 to-transparent",
};

const bookmarkCategoryChipClassNames: Record<
  BookmarkCategory,
  {
    idle: string;
    selected: string;
  }
> = {
  boss: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-orange-400 hover:from-orange-500/15 hover:via-orange-500/5 hover:to-transparent hover:text-orange-400",
    selected:
      "border-orange-400 bg-gradient-to-r from-orange-500/15 via-orange-500/5 to-transparent text-orange-400",
  },
  death: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-red-500 hover:from-red-600/15 hover:via-red-600/5 hover:to-transparent hover:text-red-500",
    selected:
      "border-red-500 bg-gradient-to-r from-red-600/15 via-red-600/5 to-transparent text-red-500",
  },
  hideout: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-sky-400 hover:from-sky-500/15 hover:via-sky-500/5 hover:to-transparent hover:text-sky-400",
    selected:
      "border-sky-400 bg-gradient-to-r from-sky-500/15 via-sky-500/5 to-transparent text-sky-400",
  },
  manual: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-purple-300 hover:from-purple-400/15 hover:via-purple-400/5 hover:to-transparent hover:text-purple-300",
    selected:
      "border-purple-300 bg-gradient-to-r from-purple-400/15 via-purple-400/5 to-transparent text-purple-300",
  },
  map: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-emerald-400 hover:from-emerald-500/15 hover:via-emerald-500/5 hover:to-transparent hover:text-emerald-400",
    selected:
      "border-emerald-400 bg-gradient-to-r from-emerald-500/15 via-emerald-500/5 to-transparent text-emerald-400",
  },
  pinnacle: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-amber-300 hover:from-amber-400/15 hover:via-amber-400/5 hover:to-transparent hover:text-amber-300",
    selected:
      "border-amber-300 bg-gradient-to-r from-amber-400/15 via-amber-400/5 to-transparent text-amber-300",
  },
  "rewind-manual-replay": {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-purple-300 hover:from-purple-400/15 hover:via-purple-400/5 hover:to-transparent hover:text-purple-300",
    selected:
      "border-purple-300 bg-gradient-to-r from-purple-400/15 via-purple-400/5 to-transparent text-purple-300",
  },
  town: {
    idle: "border-base-content/10 bg-gradient-to-r from-base-300 via-base-300 to-base-300 text-base-content/45 hover:border-zinc-300 hover:from-zinc-400/15 hover:via-zinc-400/5 hover:to-transparent hover:text-zinc-300",
    selected:
      "border-zinc-300 bg-gradient-to-r from-zinc-400/15 via-zinc-400/5 to-transparent text-zinc-300",
  },
};

const bookmarkCategoryPanelItemClassNames: Record<BookmarkCategory, string> = {
  boss: "hover:border-orange-400/70 hover:bg-gradient-to-r hover:from-orange-500/15 hover:via-orange-500/5 hover:to-transparent hover:text-orange-400",
  death:
    "hover:border-red-500/70 hover:bg-gradient-to-r hover:from-red-600/15 hover:via-red-600/5 hover:to-transparent hover:text-red-500",
  hideout:
    "hover:border-sky-400/70 hover:bg-gradient-to-r hover:from-sky-500/15 hover:via-sky-500/5 hover:to-transparent hover:text-sky-400",
  manual:
    "hover:border-purple-300/70 hover:bg-gradient-to-r hover:from-purple-400/15 hover:via-purple-400/5 hover:to-transparent hover:text-purple-300",
  map: "hover:border-emerald-400/70 hover:bg-gradient-to-r hover:from-emerald-500/15 hover:via-emerald-500/5 hover:to-transparent hover:text-emerald-400",
  pinnacle:
    "hover:border-amber-300/70 hover:bg-gradient-to-r hover:from-amber-400/15 hover:via-amber-400/5 hover:to-transparent hover:text-amber-300",
  "rewind-manual-replay":
    "hover:border-purple-300/70 hover:bg-gradient-to-r hover:from-purple-400/15 hover:via-purple-400/5 hover:to-transparent hover:text-purple-300",
  town: "hover:border-zinc-300/70 hover:bg-gradient-to-r hover:from-zinc-400/15 hover:via-zinc-400/5 hover:to-transparent hover:text-zinc-300",
};

export {
  allBookmarkCategoriesValue,
  bookmarkCategoryBadgeClassNames,
  bookmarkCategoryChipClassNames,
  bookmarkCategoryIconClassNames,
  bookmarkCategoryLabels,
  bookmarkCategoryPanelItemClassNames,
  bookmarkCategoryRowClassNames,
  bookmarkCategoryTimelineClassNames,
  bookmarkCategoryTimelineLineClassNames,
  bookmarkCategoryTimelineThumbClassNames,
};
