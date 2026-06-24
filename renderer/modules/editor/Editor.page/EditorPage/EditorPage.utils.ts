import type {
  EditorMediaReference,
  EditorProject,
} from "~/main/modules/editor";
import { formatBytes } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { formatEditorTimestamp } from "../../Editor.utils/Editor.utils";

function createExportTitle(status: string): string {
  if (status === "ready") {
    return "Your video is ready";
  }

  if (status === "failed") {
    return "Export failed";
  }

  return "Exporting video";
}

function createExportSubtitle(input: {
  fileName: string | null;
  result: {
    durationSeconds: number;
    fileName: string;
    sizeBytes: number;
  } | null;
  status: string;
}): string {
  if (input.result) {
    return `${input.result.fileName} - ${formatEditorTimestamp(
      input.result.durationSeconds,
    )} - ${formatBytes(input.result.sizeBytes)}`;
  }

  return input.fileName ?? (input.status === "failed" ? "Export failed" : "");
}

function shouldHydrateEditorProject(input: {
  project: EditorProject;
  sourceId: string | undefined;
  sourceKind: EditorMediaReference["kind"] | undefined;
}): boolean {
  if (!input.sourceId || !input.sourceKind) {
    return false;
  }

  const sourceAsset = input.project.assets.find(
    (asset) => asset.kind === input.sourceKind && asset.id === input.sourceId,
  );
  if (!sourceAsset) {
    return true;
  }

  return !input.project.tracks.some((track) =>
    track.clips.some((clip) => clip.assetKey === sourceAsset.assetKey),
  );
}

function isEditorDeleteShortcut(event: KeyboardEvent): boolean {
  return event.key === "Delete" || event.code === "Delete";
}

function isEditorShortcutEditableTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLElement &&
    (target.isContentEditable ||
      target.contentEditable === "true" ||
      target.getAttribute("contenteditable") === "true" ||
      target.tagName === "INPUT" ||
      target.tagName === "TEXTAREA" ||
      target.tagName === "SELECT")
  );
}

export {
  createExportSubtitle,
  createExportTitle,
  isEditorDeleteShortcut,
  isEditorShortcutEditableTarget,
  shouldHydrateEditorProject,
};
