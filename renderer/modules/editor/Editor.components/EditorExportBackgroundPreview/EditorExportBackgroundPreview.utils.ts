import type { EditorExportPreviewClip } from "~/main/modules/editor";

function resolveEditorExportPreviewClipEndSeconds(
  clip: Pick<
    EditorExportPreviewClip,
    "durationSeconds" | "inSeconds" | "outSeconds" | "playbackRate"
  >,
): number {
  return Math.min(
    clip.outSeconds,
    clip.inSeconds + clip.durationSeconds * clip.playbackRate,
  );
}

export { resolveEditorExportPreviewClipEndSeconds };
