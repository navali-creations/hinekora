import { createFileRoute } from "@tanstack/react-router";

import { RewindsPage } from "~/renderer/modules/rewinds/Rewinds.page/RewindsPage/RewindsPage";

export const Route = createFileRoute("/rewinds")({
  component: RewindsPage,
});
