import { useClipPreviewOverlayDetail } from "../useClipPreviewOverlayDetail/useClipPreviewOverlayDetail";
import { useClipPreviewOverlayOperations } from "../useClipPreviewOverlayOperations/useClipPreviewOverlayOperations";

function useClipPreviewOverlayWorkflow(mediaLifecycle: {
  prepareForFileMutation: () => void;
  reloadAfterFileMutation: () => void;
}) {
  const detail = useClipPreviewOverlayDetail();
  const operations = useClipPreviewOverlayOperations(detail, mediaLifecycle);

  return {
    ...operations,
    subtitle: detail.subtitle,
    title: detail.title,
  };
}

type ClipPreviewOverlayWorkflow = ReturnType<
  typeof useClipPreviewOverlayWorkflow
>;

export type { ClipPreviewOverlayWorkflow };
export { useClipPreviewOverlayWorkflow };
