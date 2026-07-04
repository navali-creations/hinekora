import { createFileRoute } from "@tanstack/react-router";

import { RewindDetailPage } from "~/renderer/modules/rewinds/Rewinds.page/RewindDetailPage/RewindDetailPage";

interface RewindDetailSearch {
  t?: number;
}

function validateRewindDetailSearch(
  search: Record<string, unknown>,
): RewindDetailSearch {
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

function RewindDetailRoute() {
  const { rewindId } = Route.useParams();
  const search = Route.useSearch();

  return (
    <RewindDetailPage
      initialPlaybackSeconds={search.t ?? null}
      rewindId={rewindId}
    />
  );
}

export const Route = createFileRoute("/rewind/$rewindId")({
  component: RewindDetailRoute,
  validateSearch: validateRewindDetailSearch,
});
