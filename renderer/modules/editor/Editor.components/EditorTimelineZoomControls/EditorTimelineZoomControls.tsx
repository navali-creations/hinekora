import { FiMinus, FiPlus } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import {
  createZoomTooltip,
  resolveEditorTimelineZoomControlState,
} from "./EditorTimelineZoomControls.utils";

function EditorTimelineZoomControls() {
  const { project, selectedClipId, setZoom, zoom } = useEditorShallow(
    (editor) => ({
      project: editor.project,
      selectedClipId: editor.selectedClipId,
      setZoom: editor.setZoom,
      zoom: editor.zoom,
    }),
  );
  const zoomControlState = resolveEditorTimelineZoomControlState({
    project,
    selectedClipId,
    zoom,
  });
  const zoomOutTooltip = createZoomTooltip({
    boundaryLabel: "Cannot zoom out further",
    hasSelectedClip: zoomControlState.hasSelectedClip,
    isAtBoundary: zoomControlState.isZoomOutAtBoundary,
    label: "Zoom out timeline",
  });
  const zoomInTooltip = createZoomTooltip({
    boundaryLabel: "Cannot zoom in further",
    hasSelectedClip: zoomControlState.hasSelectedClip,
    isAtBoundary: zoomControlState.isZoomInAtBoundary,
    label: "Zoom in timeline",
  });

  const handleZoomOut = () => {
    if (zoomControlState.isZoomOutDisabled) {
      return;
    }

    setZoom(zoomControlState.nextZoomOut);
  };

  const handleZoomIn = () => {
    if (zoomControlState.isZoomInDisabled) {
      return;
    }

    setZoom(zoomControlState.nextZoomIn);
  };

  return (
    <div className="join justify-self-end">
      <span
        className="tooltip tooltip-left join-item"
        data-tip={zoomOutTooltip}
      >
        <button
          aria-label="Zoom out timeline"
          className="btn btn-ghost btn-xs"
          disabled={zoomControlState.isZoomOutDisabled}
          type="button"
          onClick={handleZoomOut}
        >
          <FiMinus size={14} />
        </button>
      </span>
      <span className="tooltip tooltip-left join-item" data-tip={zoomInTooltip}>
        <button
          aria-label="Zoom in timeline"
          className="btn btn-ghost btn-xs"
          disabled={zoomControlState.isZoomInDisabled}
          type="button"
          onClick={handleZoomIn}
        >
          <FiPlus size={14} />
        </button>
      </span>
    </div>
  );
}

export { EditorTimelineZoomControls };
