import type { ChangeEvent } from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiRefreshCw as RefreshCw,
} from "react-icons/fi";

import { useDesktopCaptureStream } from "~/renderer/modules/capture-preview/CapturePreview.hooks/useDesktopCaptureStream/useDesktopCaptureStream";
import { useCapturePreviewShallow, useProfilesShallow } from "~/renderer/store";

import {
  createCaptureTargetFromPreviewSource,
  createDesktopPreviewConstraints,
  isSameCaptureTarget,
} from "./CapturePreviewPanel.utils";

function CapturePreviewPanel() {
  const {
    captureError,
    isLoading,
    refresh,
    select,
    selectedSourceId,
    sources,
  } = useCapturePreviewShallow((capturePreview) => ({
    captureError: capturePreview.error,
    isLoading: capturePreview.isLoading,
    refresh: capturePreview.refresh,
    select: capturePreview.select,
    selectedSourceId: capturePreview.selectedSourceId,
    sources: capturePreview.sources,
  }));
  const { profileItems, selectedProfileId, updateProfile } = useProfilesShallow(
    (profiles) => ({
      profileItems: profiles.items,
      selectedProfileId: profiles.selectedProfileId,
      updateProfile: profiles.update,
    }),
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [previewSourceId, setPreviewSourceId] = useState<string | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);

  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  );

  const selectedProfile = useMemo(
    () =>
      profileItems.find((profile) => profile.id === selectedProfileId) ?? null,
    [profileItems, selectedProfileId],
  );
  const {
    stream,
    error: streamError,
    isStarting,
    stop: stopPreviewStream,
  } = useDesktopCaptureStream({
    sourceId: previewSourceId,
    enabled: previewSourceId !== null,
    createConstraints: createDesktopPreviewConstraints,
  });
  const isPreviewing = stream !== null || isStarting;

  const clearPreviewVideo = useCallback(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const stopPreview = useCallback(() => {
    stopPreviewStream();
    setPreviewSourceId(null);
    clearPreviewVideo();
  }, [clearPreviewVideo, stopPreviewStream]);

  const persistCaptureTarget = useCallback(
    (source: NonNullable<typeof selectedSource>) => {
      if (!selectedProfile) {
        return;
      }

      const captureTarget = createCaptureTargetFromPreviewSource(source);
      if (isSameCaptureTarget(selectedProfile.captureTarget, captureTarget)) {
        return;
      }

      void updateProfile({
        id: selectedProfile.id,
        captureTarget,
      });
    },
    [selectedProfile, updateProfile],
  );

  const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    stopPreview();
    const sourceId = event.target.value;
    select(sourceId);
    const source = sources.find((item) => item.id === sourceId) ?? null;
    if (source) {
      persistCaptureTarget(source);
    }
  };

  const handleRefresh = () => {
    stopPreview();
    void refresh({ force: true });
  };

  const handleStartPreview = async () => {
    if (!selectedSource) {
      setPreviewError("Select a screen or window first");
      return;
    }

    stopPreview();
    setPreviewError(null);
    setPreviewSourceId(selectedSource.id);
  };

  const handleTogglePreview = () => {
    if (isPreviewing || previewSourceId !== null) {
      stopPreview();
      return;
    }

    void handleStartPreview();
  };

  useEffect(
    () => () => {
      stopPreviewStream();
      clearPreviewVideo();
    },
    [clearPreviewVideo, stopPreviewStream],
  );

  useEffect(() => {
    if (!videoRef.current) {
      return;
    }

    if (!stream) {
      videoRef.current.srcObject = null;
      return;
    }

    videoRef.current.srcObject = stream;
    void videoRef.current.play().catch(() => {
      setPreviewError("Unable to start preview playback");
    });
  }, [stream]);

  useEffect(() => {
    if (!selectedSource) {
      return;
    }

    persistCaptureTarget(selectedSource);
  }, [persistCaptureTarget, selectedSource]);

  return (
    <section className="col-span-7 grid min-h-[388px] gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">Live Preview</h2>
      </div>

      <div className="relative grid min-h-[252px] min-w-[18px] place-items-center overflow-hidden rounded-lg border border-base-content/10 bg-gradient-to-br from-base-300 to-base-200">
        <video
          aria-label="Capture preview"
          className="absolute inset-0 h-full w-full object-contain"
          muted
          playsInline
          ref={videoRef}
        />
        {!isPreviewing && selectedSource?.thumbnailDataUrl && (
          <img
            alt=""
            className="absolute inset-0 h-full w-full object-contain opacity-45 saturate-[0.85]"
            src={selectedSource.thumbnailDataUrl}
          />
        )}
        {!isPreviewing && (
          <div className="relative z-[1] inline-flex items-center gap-2 rounded-md border border-primary/30 bg-secondary/70 px-3 py-2 text-primary">
            <Eye size={22} />
            <span>
              {selectedSource ? "Preview stopped" : "No capture source"}
            </span>
          </div>
        )}
      </div>

      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
        <label className="grid gap-1.5 text-primary text-[0.8125rem]">
          Source
          <select
            className="select select-bordered select-sm w-full"
            disabled={isLoading}
            value={selectedSourceId ?? ""}
            onChange={handleSourceChange}
          >
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.name}
              </option>
            ))}
          </select>
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn btn-primary btn-sm"
            type="button"
            disabled={
              !selectedSource && !isPreviewing && previewSourceId === null
            }
            onClick={handleTogglePreview}
          >
            {isPreviewing || previewSourceId !== null ? (
              <EyeOff size={16} />
            ) : (
              <Eye size={16} />
            )}
            {isPreviewing || previewSourceId !== null
              ? "Stop Preview"
              : "Show Preview"}
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={handleRefresh}
          >
            <RefreshCw size={16} />
            Refresh
          </button>
        </div>
      </div>

      {(captureError || previewError || streamError) && (
        <p className="m-0 text-error text-[0.8125rem]">
          {previewError ?? streamError ?? captureError}
        </p>
      )}
    </section>
  );
}

export { CapturePreviewPanel };
