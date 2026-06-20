import { createFileRoute } from "@tanstack/react-router";

import { RecordingsPage } from "~/renderer/modules/recordings/Recordings.page/Recordings.page";

export const Route = createFileRoute("/recordings")({
  component: RecordingsPage,
});
