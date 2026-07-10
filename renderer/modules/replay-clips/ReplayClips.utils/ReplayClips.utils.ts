import type { ReplayClipView } from "~/main/modules/replay-clips";

function hasPlayableClip(clip: ReplayClipView): boolean {
  return clip.hasMediaFile && clip.sizeBytes > 0;
}

export { hasPlayableClip };
