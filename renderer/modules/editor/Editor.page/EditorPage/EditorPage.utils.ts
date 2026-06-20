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

  return !input.project.assets.some(
    (asset) => asset.kind === input.sourceKind && asset.id === input.sourceId,
  );
}

export { createExportSubtitle, createExportTitle, shouldHydrateEditorProject };
