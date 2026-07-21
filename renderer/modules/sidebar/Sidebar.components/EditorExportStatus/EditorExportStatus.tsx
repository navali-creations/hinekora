import { Link } from "@tanstack/react-router";
import clsx from "clsx";

import { MediaProcessingBackdrop } from "~/renderer/components/MediaProcessingBackdrop/MediaProcessingBackdrop";
import { useEditorShallow } from "~/renderer/store";

function EditorExportStatus() {
  const {
    canCancel,
    error,
    isCancellationPending,
    keepEditingAfterExport,
    openExportCancellationConfirmation,
    progress,
    status,
    viewExport,
  } = useEditorShallow((editor) => ({
    canCancel: editor.exportState.canCancel,
    error: editor.exportState.error,
    isCancellationPending: editor.exportState.isCancellationPending,
    keepEditingAfterExport: editor.keepEditingAfterExport,
    openExportCancellationConfirmation:
      editor.openExportCancellationConfirmation,
    progress: editor.exportState.progress,
    status: editor.exportState.status,
    viewExport: editor.viewExport,
  }));

  if (status === "idle") {
    return null;
  }

  const progressPercent =
    status === "ready"
      ? 100
      : Math.round(Math.min(Math.max(progress, 0), 1) * 100);
  let statusLabel = canCancel ? "Saving video" : "Finishing video";
  if (status === "ready") {
    statusLabel = "Video saved";
  } else if (status === "failed") {
    statusLabel = "Save failed";
  }
  let cancellationLabel = "Finishing";
  if (canCancel) {
    cancellationLabel = isCancellationPending ? "Stopping" : "Cancel";
  }

  const handleView = () => {
    viewExport();
  };

  const handleCancel = () => {
    openExportCancellationConfirmation();
  };

  const handleDismiss = () => {
    void keepEditingAfterExport();
  };

  return (
    <section
      aria-label="Background video processing"
      className="absolute inset-x-3 bottom-3 isolate overflow-hidden rounded border border-base-content/15 p-2"
      data-testid="sidebar-editor-export-status"
    >
      <MediaProcessingBackdrop />
      <div className="relative z-[1] grid gap-2">
        <div className="flex items-center justify-between gap-2 text-xs">
          <span className="truncate font-semibold">{statusLabel}</span>
          <strong className="text-primary tabular-nums">
            {progressPercent}%
          </strong>
        </div>
        <progress
          aria-label="Background video export progress"
          className="progress progress-primary h-1 w-full"
          max={100}
          value={progressPercent}
        />
        {error && (
          <p className="line-clamp-2 text-error text-xs" role="alert">
            {error}
          </p>
        )}
        <div className="grid grid-cols-2 gap-1">
          <Link
            className="btn btn-primary btn-xs min-w-0"
            to="/editor"
            onClick={handleView}
          >
            View
          </Link>
          {status === "exporting" ? (
            <button
              className={clsx("btn btn-xs min-w-0", {
                "btn-error": canCancel,
                "btn-ghost": !canCancel,
              })}
              disabled={!canCancel || isCancellationPending}
              type="button"
              onClick={handleCancel}
            >
              {cancellationLabel}
            </button>
          ) : (
            <button
              className="btn btn-ghost btn-xs min-w-0"
              type="button"
              onClick={handleDismiss}
            >
              Dismiss
            </button>
          )}
        </div>
      </div>
    </section>
  );
}

export { EditorExportStatus };
