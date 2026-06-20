import { createFileRoute } from "@tanstack/react-router";

import { SettingsPage } from "~/renderer/modules/settings/Settings.page/SettingsPage/SettingsPage";

export const Route = createFileRoute("/settings")({
  component: SettingsPage,
});
