import type { RefObject } from "react";
import { useMemo } from "react";
import { FiEye as Eye } from "react-icons/fi";

import { isCapturePreviewSourceAvailable } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { useCapturePreviewShallow } from "~/renderer/store";

interface CapturePreviewViewportProps {
  isPreviewing: boolean;
  videoRef: RefObject<HTMLVideoElement | null>;
}

function CapturePreviewViewport({
  isPreviewing,
  videoRef,
}: CapturePreviewViewportProps) {
  const { selectedSourceId, selectedThumbnailDataUrl, sources } =
    useCapturePreviewShallow((capturePreview) => ({
      selectedSourceId: capturePreview.selectedSourceId,
      selectedThumbnailDataUrl:
        capturePreview.selectedSourceId !== null
          ? (capturePreview.thumbnailsBySourceId[
              capturePreview.selectedSourceId
            ] ?? null)
          : null,
      sources: capturePreview.sources,
    }));
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  );
  const previewStatusLabel =
    selectedSource && !isCapturePreviewSourceAvailable(selectedSource)
      ? "Source unavailable"
      : selectedSource
        ? "Preview stopped"
        : "No capture source";

  return (
    <div className="relative grid min-h-[252px] min-w-[18px] place-items-center overflow-hidden rounded-lg border border-base-content/10 bg-gradient-to-br from-base-300 to-base-200">
      <video
        aria-label="Capture preview"
        className="absolute inset-0 h-full w-full object-contain"
        muted
        playsInline
        ref={videoRef}
      />
      {!isPreviewing && selectedThumbnailDataUrl && (
        <img
          alt=""
          className="absolute inset-0 h-full w-full object-contain opacity-45 saturate-[0.85]"
          src={selectedThumbnailDataUrl}
        />
      )}
      {!isPreviewing && (
        <div className="relative z-[1] inline-flex items-center gap-2 rounded-md border border-primary/30 bg-secondary/70 px-3 py-2 text-primary">
          <Eye size={22} />
          <span>{previewStatusLabel}</span>
        </div>
      )}
    </div>
  );
}

export { CapturePreviewViewport };
