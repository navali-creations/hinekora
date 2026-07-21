import { useEditorShallow } from "~/renderer/store";

import { useEditorExportBackgroundPreview } from "./useEditorExportBackgroundPreview/useEditorExportBackgroundPreview";

function EditorExportBackgroundPreview() {
  const clips =
    useEditorShallow((editor) => editor.exportState.previewClips) ?? [];
  const {
    activeClip,
    advanceClip,
    handleLoadedMetadata,
    handleTimeUpdate,
    videoRef,
  } = useEditorExportBackgroundPreview(clips);

  return (
    <div
      className="relative z-[2] grid min-h-0 min-w-0 place-items-center overflow-hidden bg-transparent"
      data-testid="editor-export-background-preview"
    >
      {activeClip ? (
        <video
          aria-label="Edited video preview"
          className="block h-full min-h-0 w-full object-contain"
          key={activeClip.id}
          muted
          playsInline
          preload="metadata"
          ref={videoRef}
          src={activeClip.mediaUrl}
          title={activeClip.name}
          onEnded={advanceClip}
          onLoadedMetadata={handleLoadedMetadata}
          onTimeUpdate={handleTimeUpdate}
        />
      ) : (
        <span className="relative z-[2] text-base-content/45 text-sm">
          Preview unavailable
        </span>
      )}
    </div>
  );
}

export { EditorExportBackgroundPreview };
