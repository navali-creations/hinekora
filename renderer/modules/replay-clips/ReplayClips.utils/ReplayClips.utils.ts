import type { ReplayClip } from "~/types";

function hasPlayableClip(clip: ReplayClip): boolean {
  return Boolean(
    (clip.processedClipPath || clip.originalObsPath) && clip.sizeBytes > 0,
  );
}

export { hasPlayableClip };
