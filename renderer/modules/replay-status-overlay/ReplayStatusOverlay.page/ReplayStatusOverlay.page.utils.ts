import { ReplayStatusOverlayClipIdSchema } from "~/main/modules/replay-status-overlay/ReplayStatusOverlay.dto";

function readReplayStatusClipId(hash = window.location.hash): string | null {
  const queryStart = hash.indexOf("?");
  if (queryStart < 0) {
    return null;
  }

  const parsedClipId = ReplayStatusOverlayClipIdSchema.safeParse(
    new URLSearchParams(hash.slice(queryStart + 1)).get("clipId"),
  );
  return parsedClipId.success ? parsedClipId.data : null;
}

export { readReplayStatusClipId };
