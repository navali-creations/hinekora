function createCopyDisabledReason(input: {
  exportStatus: string;
  isCopying: boolean;
  project: unknown;
  selectedClipId: string | null;
}): string | null {
  if (!input.project) {
    return "Add a clip to the timeline before copying.";
  }
  if (!input.selectedClipId) {
    return "Select a timeline clip before copying.";
  }
  if (input.isCopying) {
    return "Copy is already processing.";
  }
  if (input.exportStatus === "exporting") {
    return "Wait for the current save to finish.";
  }

  return null;
}

export { createCopyDisabledReason };
