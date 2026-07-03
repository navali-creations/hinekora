import { createFileRoute } from "@tanstack/react-router";

import { RewindDetailPage } from "~/renderer/modules/rewinds/Rewinds.page/RewindDetailPage/RewindDetailPage";

function RewindDetailRoute() {
  const { rewindId } = Route.useParams();

  return <RewindDetailPage rewindId={rewindId} />;
}

export const Route = createFileRoute("/rewind/$rewindId")({
  component: RewindDetailRoute,
});
