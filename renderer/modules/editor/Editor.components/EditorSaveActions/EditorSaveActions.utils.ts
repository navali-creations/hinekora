import { createEditorDefaultFileName } from "../../Editor.utils/Editor.utils";

function createSaveDisabledReason(input: {
  isExporting: boolean;
  project: unknown;
  selectedClipId: string | null;
}): string | null {
  if (!input.project) {
    return "Add a clip to the timeline before saving.";
  }
  if (!input.selectedClipId) {
    return "Select a timeline clip before saving.";
  }
  if (input.isExporting) {
    return "Wait for the current save to finish.";
  }

  return null;
}

function createEditorFileNameDraft(
  project: Parameters<typeof createEditorDefaultFileName>[0],
): string {
  return stripMp4Extension(createEditorDefaultFileName(project));
}

function createEditorOutputFileName(fileName: string): string {
  const trimmedFileName = fileName.trim();

  return trimmedFileName.toLowerCase().endsWith(".mp4")
    ? trimmedFileName
    : `${trimmedFileName}.mp4`;
}

function stripMp4Extension(fileName: string): string {
  return fileName.replace(/\.mp4$/i, "");
}

export {
  createEditorFileNameDraft,
  createEditorOutputFileName,
  createSaveDisabledReason,
  stripMp4Extension,
};
