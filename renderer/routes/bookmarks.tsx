import { createFileRoute } from "@tanstack/react-router";

import { BookmarksPage } from "~/renderer/modules/bookmarks/Bookmarks.page/Bookmarks.page";

export const Route = createFileRoute("/bookmarks")({
  component: BookmarksPage,
});
