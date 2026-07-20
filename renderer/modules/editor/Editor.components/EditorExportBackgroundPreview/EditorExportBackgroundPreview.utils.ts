import type { EditorProject, EditorTimelineClip } from "~/main/modules/editor";

type EditorExportPreviewClip = EditorTimelineClip & { mediaUrl: string };

function createEditorExportPreviewClips(
  project: EditorProject | null,
): EditorExportPreviewClip[] {
  if (!project) {
    return [];
  }

  return project.tracks
    .flatMap((track) => track.clips)
    .filter(
      (clip): clip is EditorExportPreviewClip =>
        typeof clip.mediaUrl === "string" && clip.mediaUrl.length > 0,
    )
    .sort(
      (first, second) =>
        first.startSeconds - second.startSeconds ||
        first.inSeconds - second.inSeconds ||
        first.id.localeCompare(second.id),
    );
}

function resolveEditorExportPreviewClipEndSeconds(
  clip: EditorTimelineClip,
): number {
  return Math.min(
    clip.outSeconds,
    clip.inSeconds + clip.durationSeconds * clip.playbackRate,
  );
}

export {
  createEditorExportPreviewClips,
  type EditorExportPreviewClip,
  resolveEditorExportPreviewClipEndSeconds,
};
