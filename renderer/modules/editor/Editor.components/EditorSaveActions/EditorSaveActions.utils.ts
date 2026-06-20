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
    return "Wait for the current export to finish.";
  }

  return null;
}

export { createSaveDisabledReason };
