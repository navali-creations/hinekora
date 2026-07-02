import type { ChangeEvent } from "react";
import { useMemo } from "react";
import {
  FiEye as Eye,
  FiEyeOff as EyeOff,
  FiRefreshCw as RefreshCw,
} from "react-icons/fi";

import {
  createCapturePreviewSourceLabel,
  isCapturePreviewSourceAvailable,
  isCapturePreviewSourceCompatibleWithGame,
} from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { CaptureProfileLockToggle } from "~/renderer/modules/capture-profiles/CaptureProfiles.components/CaptureProfileLockToggle/CaptureProfileLockToggle";
import {
  useCapturePreviewShallow,
  useSettingsSelector,
} from "~/renderer/store";

import type { CapturePreviewSource } from "~/types";

interface CapturePreviewSourceControlsProps {
  isPreviewing: boolean;
  previewSourceId: string | null;
  onRefresh: () => void;
  onSourceChange: (
    sourceId: string,
    source: CapturePreviewSource | null,
  ) => void;
  onTogglePreview: () => void;
}

function CapturePreviewSourceControls({
  isPreviewing,
  onRefresh,
  onSourceChange,
  onTogglePreview,
  previewSourceId,
}: CapturePreviewSourceControlsProps) {
  const { isLoading, selectedSourceId, sources } = useCapturePreviewShallow(
    (capturePreview) => ({
      isLoading: capturePreview.isLoading,
      selectedSourceId: capturePreview.selectedSourceId,
      sources: capturePreview.sources,
    }),
  );
  const activeGame = useSettingsSelector(
    (settings) => settings.value?.activeGame ?? "poe1",
  );
  const selectedSource = useMemo(
    () => sources.find((source) => source.id === selectedSourceId) ?? null,
    [selectedSourceId, sources],
  );
  const canPreviewSelectedSource =
    isCapturePreviewSourceAvailable(selectedSource);
  const isPreviewToggleDisabled =
    !canPreviewSelectedSource && !isPreviewing && previewSourceId === null;

  const handleSourceChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const sourceId = event.target.value;
    onSourceChange(
      sourceId,
      sources.find((source) => source.id === sourceId) ?? null,
    );
  };

  return (
    <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
      <div
        className="grid gap-1.5 text-primary text-[0.8125rem]"
        data-onboarding="capture-source"
      >
        <span>Source</span>
        <div className="join w-full">
          <select
            aria-label="Capture source"
            className="join-item select select-bordered select-sm min-w-0 flex-1 focus:outline-none focus-visible:outline-none"
            disabled={isLoading}
            value={selectedSourceId ?? ""}
            onChange={handleSourceChange}
          >
            {sources.map((source) => {
              const isSourceDisabled =
                !isCapturePreviewSourceCompatibleWithGame(source, activeGame);

              return (
                <option
                  disabled={isSourceDisabled}
                  key={source.id}
                  value={source.id}
                >
                  {createCapturePreviewSourceLabel(source)}
                </option>
              );
            })}
          </select>
          <CaptureProfileLockToggle attached />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          disabled={isPreviewToggleDisabled}
          onClick={onTogglePreview}
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
          onClick={onRefresh}
        >
          <RefreshCw size={16} />
          Refresh
        </button>
      </div>
    </div>
  );
}

export { CapturePreviewSourceControls };
