const editorMediaAssetDragType = "editor-media-asset";
const editorVideoTrackDropType = "editor-video-track";

interface EditorMediaAssetDragData {
  assetKey: string;
  kind: typeof editorMediaAssetDragType;
}

interface EditorVideoTrackDropData {
  kind: typeof editorVideoTrackDropType;
  trackId: string;
}

function isEditorMediaAssetDragData(
  value: unknown,
): value is EditorMediaAssetDragData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === editorMediaAssetDragType &&
    "assetKey" in value &&
    typeof value.assetKey === "string"
  );
}

function isEditorVideoTrackDropData(
  value: unknown,
): value is EditorVideoTrackDropData {
  return (
    typeof value === "object" &&
    value !== null &&
    "kind" in value &&
    value.kind === editorVideoTrackDropType &&
    "trackId" in value &&
    typeof value.trackId === "string"
  );
}

export type { EditorMediaAssetDragData, EditorVideoTrackDropData };
export {
  editorMediaAssetDragType,
  editorVideoTrackDropType,
  isEditorMediaAssetDragData,
  isEditorVideoTrackDropData,
};
