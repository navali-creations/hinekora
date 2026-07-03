import { createFileRoute } from "@tanstack/react-router";

import { RecordingDetailPage } from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingDetailPage";

interface RecordingDetailSearch {
  t?: number;
}

function validateRecordingDetailSearch(
  search: Record<string, unknown>,
): RecordingDetailSearch {
  const timestamp =
    typeof search.t === "number"
      ? search.t
      : typeof search.t === "string"
        ? Number(search.t)
        : null;

  return typeof timestamp === "number" &&
    Number.isFinite(timestamp) &&
    timestamp >= 0
    ? { t: timestamp }
    : {};
}

function RecordingDetailRoute() {
  const { recordingId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <RecordingDetailPage
      initialPlaybackSeconds={search.t ?? null}
      recordingId={recordingId}
    />
  );
}

export const Route = createFileRoute("/recording/$recordingId")({
  component: RecordingDetailRoute,
  validateSearch: validateRecordingDetailSearch,
});
