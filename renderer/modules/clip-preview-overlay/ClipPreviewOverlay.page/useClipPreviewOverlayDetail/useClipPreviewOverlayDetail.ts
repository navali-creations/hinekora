import { useEffect, useMemo, useRef } from "react";

import { useClipPreviewOverlayShallow } from "~/renderer/store";

import {
  getClipPreviewFileTitle,
  resolveClipPreviewDetail,
  resolveClipPreviewHeaderState,
  resolveClipPreviewRouteClipId,
  roundClipPreviewSeconds,
} from "../../ClipPreviewOverlay.utils/ClipPreviewOverlay.utils";

function useClipPreviewOverlayDetail() {
  const initializedClipIdRef = useRef<string | null>(null);
  const clipId = useMemo(
    () => resolveClipPreviewRouteClipId(window.location.hash),
    [],
  );
  const {
    detail,
    detailError,
    durationOverrideSeconds,
    reset,
    resetLoadedClipState,
    setCopied,
    setDetail,
    setDetailError,
    setHasSavedClip,
  } = useClipPreviewOverlayShallow((clipPreviewOverlay) => ({
    detail: clipPreviewOverlay.detail,
    detailError: clipPreviewOverlay.detailError,
    durationOverrideSeconds: clipPreviewOverlay.durationOverrideSeconds,
    reset: clipPreviewOverlay.reset,
    resetLoadedClipState: clipPreviewOverlay.resetLoadedClipState,
    setCopied: clipPreviewOverlay.setCopied,
    setDetail: clipPreviewOverlay.setDetail,
    setDetailError: clipPreviewOverlay.setDetailError,
    setHasSavedClip: clipPreviewOverlay.setHasSavedClip,
  }));
  const { clip, clipFileName, durationSeconds } = resolveClipPreviewDetail(
    detail,
    durationOverrideSeconds,
  );
  const fileTitle = useMemo(
    () => getClipPreviewFileTitle(clipFileName),
    [clipFileName],
  );

  useEffect(() => {
    reset();

    if (!clipId) {
      return;
    }

    let isActive = true;
    const loadClipDetail = () =>
      window.electron.replayClips
        .get(clipId)
        .then((nextDetail) => {
          if (isActive) {
            setDetail(nextDetail);
            setDetailError(null);
          }
        })
        .catch((error: unknown) => {
          if (isActive) {
            setDetailError(
              error instanceof Error ? error.message : "Clip metadata failed",
            );
          }
        });

    void loadClipDetail();
    const unsubscribeStatus = window.electron.replayClips.onStatusChanged(
      (nextClip) => {
        if (nextClip.id !== clipId || !isActive) {
          return;
        }

        if (nextClip.hasMediaFile) {
          void loadClipDetail();
          return;
        }

        setDetail({
          clip: nextClip,
          durationSeconds: nextClip.durationSeconds,
          mediaUrl: null,
        });
        setDetailError(null);
      },
    );

    return () => {
      isActive = false;
      unsubscribeStatus();
    };
  }, [clipId, reset, setDetail, setDetailError]);

  useEffect(() => {
    if (
      !clip?.id ||
      durationSeconds <= 0 ||
      initializedClipIdRef.current === clip.id
    ) {
      return;
    }

    initializedClipIdRef.current = clip.id;
    setHasSavedClip(false);
    setCopied(false);
    resetLoadedClipState({
      inSeconds: 0,
      outSeconds: roundClipPreviewSeconds(durationSeconds),
    });
  }, [
    clip?.id,
    durationSeconds,
    resetLoadedClipState,
    setCopied,
    setHasSavedClip,
  ]);

  const { subtitle, title } = resolveClipPreviewHeaderState({
    detail,
    detailError,
    durationOverrideSeconds,
  });

  return {
    clip,
    durationSeconds,
    fileTitle,
    subtitle,
    title,
  };
}

type ClipPreviewOverlayDetail = ReturnType<typeof useClipPreviewOverlayDetail>;

export type { ClipPreviewOverlayDetail };
export { useClipPreviewOverlayDetail };
