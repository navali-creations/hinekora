import { createFileRoute } from "@tanstack/react-router";

import { ClipsPage } from "~/renderer/modules/clips/Clips.page/Clips.page";

export const Route = createFileRoute("/clips")({
  component: ClipsPage,
});
