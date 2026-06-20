import { createFileRoute } from "@tanstack/react-router";

import { AttributionsPage } from "~/renderer/modules/attributions";

export const Route = createFileRoute("/attributions")({
  component: AttributionsPage,
});
