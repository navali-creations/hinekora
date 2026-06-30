import { FiCheckCircle, FiXCircle } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

function EditorExportView() {
  const { error, fileName, progress, project, result, status } =
    useEditorShallow((editor) => ({
      error: editor.exportState.error,
      fileName: editor.exportState.fileName,
      progress: editor.exportState.progress,
      project: editor.project,
      result: editor.exportState.result,
      status: editor.exportState.status,
    }));
  const selectedAsset =
    project?.assets.find(
      (asset) => asset.assetKey === project.selectedAssetKey,
    ) ??
    project?.assets[0] ??
    null;
  const previewUrl = result?.mediaUrl ?? selectedAsset?.mediaUrl ?? null;
  const displayFileName =
    result?.fileName ?? fileName ?? selectedAsset?.name ?? "Video project.mp4";
  const progressPercent = Math.round(Math.min(Math.max(progress, 0), 1) * 100);

  if (status === "exporting") {
    return (
      <div className="grid h-full min-h-0 place-items-center rounded-lg border border-base-content/10 bg-base-200 p-6">
        <div className="flex w-full max-w-xl items-center gap-5 rounded-lg bg-base-300 p-6">
          <span className="grid h-12 w-12 place-items-center rounded border border-primary/40 text-primary">
            <span className="loading loading-spinner loading-sm" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate font-bold">{displayFileName}</p>
            <progress
              className="progress progress-primary mt-3 h-1.5 w-full"
              max={100}
              value={progressPercent}
            />
          </div>
        </div>
      </div>
    );
  }

  if (status === "failed") {
    return (
      <div className="grid h-full min-h-0 place-items-center rounded-lg border border-base-content/10 bg-base-200 p-6">
        <div className="flex max-w-xl items-center gap-5 rounded-lg bg-base-300 p-6">
          <FiXCircle className="shrink-0 text-error" size={42} />
          <div>
            <p className="m-0 font-bold">Save failed</p>
            <p className="m-0 mt-1 text-base-content/65 text-sm">
              {error ?? "The video could not be saved."}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 min-w-0 items-center justify-center overflow-hidden rounded-lg border border-base-content/10 bg-black p-4"
      data-testid="editor-export-preview-frame"
    >
      {previewUrl ? (
        <video
          className="block h-full max-h-full min-h-0 w-auto max-w-full rounded object-contain"
          controls
          preload="metadata"
          src={previewUrl}
          title={displayFileName}
        />
      ) : (
        <div className="flex items-center gap-3 text-base-content/45 text-sm">
          <FiCheckCircle size={18} />
          Preview unavailable
        </div>
      )}
    </div>
  );
}

export { EditorExportView };
