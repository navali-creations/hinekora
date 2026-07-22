import { createFileRoute } from "@tanstack/react-router";

import { SavedVideosPage } from "~/renderer/modules/saved-videos/SavedVideos.page/SavedVideosPage/SavedVideosPage";

export const Route = createFileRoute("/saved-videos")({
  component: SavedVideosPage,
});
