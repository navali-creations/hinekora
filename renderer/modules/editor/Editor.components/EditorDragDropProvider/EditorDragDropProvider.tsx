import { DragDropProvider, type DragEndEvent } from "@dnd-kit/react";
import type { PropsWithChildren } from "react";

import { useEditorShallow } from "~/renderer/store";

import {
  isEditorMediaAssetDragData,
  isEditorVideoTrackDropData,
} from "../../Editor.utils/Editor.utils";
import { resolveDropTimelineSeconds } from "./EditorDragDropProvider.utils";

function EditorDragDropProvider({ children }: PropsWithChildren) {
  const { addAssetToTimelineAt, project, zoom } = useEditorShallow(
    (editor) => ({
      addAssetToTimelineAt: editor.addAssetToTimelineAt,
      project: editor.project,
      zoom: editor.zoom,
    }),
  );

  const handleDragEnd = (event: DragEndEvent) => {
    if (event.canceled) {
      return;
    }

    const sourceData = event.operation.source?.data;
    const targetData = event.operation.target?.data;
    if (
      !isEditorMediaAssetDragData(sourceData) ||
      !isEditorVideoTrackDropData(targetData)
    ) {
      return;
    }

    const timelineSeconds = resolveDropTimelineSeconds({
      durationSeconds: project?.durationSeconds ?? 0,
      event,
      zoom,
    });
    addAssetToTimelineAt(sourceData.assetKey, timelineSeconds);
  };

  return (
    <DragDropProvider onDragEnd={handleDragEnd}>{children}</DragDropProvider>
  );
}

export { EditorDragDropProvider };
