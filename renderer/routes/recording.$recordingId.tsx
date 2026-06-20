import { createFileRoute } from "@tanstack/react-router";

import { RecordingDetailPage } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingDetailPage";

function RecordingDetailRoute() {
  const { recordingId } = Route.useParams();

  return <RecordingDetailPage recordingId={recordingId} />;
}

export const Route = createFileRoute("/recording/$recordingId")({
  component: RecordingDetailRoute,
});
