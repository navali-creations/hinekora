import { createFileRoute } from "@tanstack/react-router";

import { ChangelogPage } from "~/renderer/modules/changelog";

export const Route = createFileRoute("/changelog")({
  component: ChangelogPage,
});
