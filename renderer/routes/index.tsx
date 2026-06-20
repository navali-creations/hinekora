import { createFileRoute } from "@tanstack/react-router";

import { DashboardPage } from "~/renderer/modules/dashboard/Dashboard.page/Dashboard.page";

export const Route = createFileRoute("/")({
  component: DashboardPage,
});
