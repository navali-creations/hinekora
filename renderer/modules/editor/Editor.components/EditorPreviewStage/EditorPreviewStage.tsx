import { useEditorPreviewPlayback } from "../../Editor.hooks/useEditorPreviewPlayback/useEditorPreviewPlayback";

function EditorPreviewStage() {
  const {
    frameStyle,
    handleEnded,
    handleLoadedMetadata,
    handleTimeUpdate,
    mediaUrl,
    stageRef,
    title,
    videoRef,
  } = useEditorPreviewPlayback();

  return (
    <section className="flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-300">
      <div
        className="grid min-h-0 flex-1 place-items-center overflow-hidden bg-black p-4"
        ref={stageRef}
      >
        {mediaUrl ? (
          <div className="overflow-hidden bg-black" style={frameStyle}>
            <video
              className="block h-full w-full object-contain"
              preload="metadata"
              ref={videoRef}
              src={mediaUrl}
              title={title}
              onEnded={handleEnded}
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
            />
          </div>
        ) : (
          <div className="rounded-lg border border-base-content/10 border-dashed p-8 text-center">
            <div className="font-semibold">No clip selected</div>
            <p className="m-0 mt-2 max-w-sm text-base-content/55 text-sm">
              Add a clip from My media or select a timeline clip to preview it
              here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

export { EditorPreviewStage };
