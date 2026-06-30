import { createFileRoute } from "@tanstack/react-router";

import { SavedEditsPage } from "~/renderer/modules/saved-edits/SavedEdits.page/SavedEditsPage/SavedEditsPage";

export const Route = createFileRoute("/saved-edits")({
  component: SavedEditsPage,
});
