import type { ReplayClipView } from "~/main/modules/replay-clips";

import type { ClipPreviewTrimRange } from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

function resolveClipPreviewOperationState(input: {
  clip: ReplayClipView | null;
  durationSeconds: number;
  fileTitle: string;
  hasSavedClip: boolean;
  isCopying: boolean;
  isMuted: boolean;
  isSaving: boolean;
  titleDraft: string;
  trim: ClipPreviewTrimRange;
}) {
  const hasTrimChanges =
    input.durationSeconds > 0 &&
    (Math.abs(input.trim.inSeconds) > 0.001 ||
      Math.abs(input.trim.outSeconds - input.durationSeconds) > 0.001);
  const trimmedTitle = input.titleDraft.trim();
  const hasTitleChange =
    trimmedTitle.length > 0 && trimmedTitle !== input.fileTitle.trim();
  const canUseClip = Boolean(
    input.clip?.hasMediaFile && input.durationSeconds > 0,
  );
  const isProcessing = input.isCopying || input.isSaving;

  return {
    canCopy: Boolean(input.clip?.hasMediaFile) && !isProcessing,
    canEdit: canUseClip && !isProcessing,
    canOpenSavedClip:
      Boolean(input.clip) && input.hasSavedClip && !isProcessing,
    canSave:
      canUseClip &&
      (hasTrimChanges || hasTitleChange || input.isMuted) &&
      !isProcessing,
    canUseClip,
    clip: input.clip,
    durationSeconds: input.durationSeconds,
    fileTitle: input.fileTitle,
    hasTitleChange,
    hasTrimChanges,
    isProcessing,
    titlePlaceholder: input.fileTitle || "2026-07-08 01-18-40",
    trimmedTitle,
  };
}

export { resolveClipPreviewOperationState };
