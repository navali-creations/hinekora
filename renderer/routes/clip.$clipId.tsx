import { createFileRoute } from "@tanstack/react-router";

import { ClipDetailPage } from "~/renderer/modules/clips/Clips.page/ClipDetailPage/ClipDetailPage";

function ClipDetailRoute() {
  const { clipId } = Route.useParams();

  return <ClipDetailPage clipId={clipId} />;
}

export const Route = createFileRoute("/clip/$clipId")({
  component: ClipDetailRoute,
});
