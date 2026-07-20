import { Link } from "@tanstack/react-router";

import { MediaProcessingBackdrop } from "~/renderer/components/MediaProcessingBackdrop/MediaProcessingBackdrop";
import { useEditorShallow } from "~/renderer/store";

function EditorExportStatus() {
  const {
    isCancellationPending,
    openExportCancellationConfirmation,
    progress,
    status,
    viewExport,
  } = useEditorShallow((editor) => ({
    isCancellationPending: editor.exportState.isCancellationPending,
    openExportCancellationConfirmation:
      editor.openExportCancellationConfirmation,
    progress: editor.exportState.progress,
    status: editor.exportState.status,
    viewExport: editor.viewExport,
  }));

  if (status !== "exporting") {
    return null;
  }

  const progressPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  const handleView = () => {
    viewExport();
  };

  const handleCancel = () => {
    openExportCancellationConfirmation();
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
          <span className="truncate font-semibold">Saving video</span>
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
        <div className="grid grid-cols-2 gap-1">
          <Link
            className="btn btn-primary btn-xs min-w-0"
            to="/editor"
            onClick={handleView}
          >
            View
          </Link>
          <button
            className="btn btn-error btn-xs min-w-0"
            disabled={isCancellationPending}
            type="button"
            onClick={handleCancel}
          >
            {isCancellationPending ? "Stopping" : "Cancel"}
          </button>
        </div>
      </div>
    </section>
  );
}

export { EditorExportStatus };
