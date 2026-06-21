import clsx from "clsx";
import type { PointerEventHandler } from "react";

import styles from "../CropLayoutPreview.module.css";
import {
  type CropLayoutPreviewModel,
  type CropResizeCorner,
  createCropPreviewBoxLabelStyle,
  createCropPreviewBoxStyle,
  createCropPreviewSurfaceStyle,
  cropResizeCorners,
  formatCropPreviewBoxLabel,
} from "../CropLayoutPreview.utils";

const resizeCornerClassNames: Record<CropResizeCorner, string> = {
  nw: styles.resizeHandleNw ?? "",
  ne: styles.resizeHandleNe ?? "",
  sw: styles.resizeHandleSw ?? "",
  se: styles.resizeHandleSe ?? "",
};

interface CropPreviewBoxLayerProps {
  activeAuraCropRegionId: string | null;
  preview: CropLayoutPreviewModel;
  sourceImageUrl: string | null;
  onResizePointerCancel: PointerEventHandler<HTMLElement>;
  onResizePointerDown: PointerEventHandler<HTMLElement>;
  onResizePointerMove: PointerEventHandler<HTMLElement>;
  onResizePointerUp: PointerEventHandler<HTMLElement>;
}

function CropPreviewBoxLayer({
  activeAuraCropRegionId,
  preview,
  sourceImageUrl,
  onResizePointerCancel,
  onResizePointerDown,
  onResizePointerMove,
  onResizePointerUp,
}: CropPreviewBoxLayerProps) {
  return (
    <>
      {preview.boxes.map((box) => (
        <div
          className={clsx(
            styles.box,
            box.kind === "source" ? styles.sourceBox : styles.auraBox,
            box.kind === "source" &&
              box.cropRegionId === activeAuraCropRegionId &&
              styles.selectedSourceBox,
            box.kind === "aura" &&
              box.cropRegionId === activeAuraCropRegionId &&
              styles.selectedBox,
            box.kind === "aura" &&
              box.cropRegionId === activeAuraCropRegionId &&
              styles.selectedAuraBox,
          )}
          key={box.id}
          style={createCropPreviewBoxStyle(box, preview.bounds)}
        >
          {sourceImageUrl && (
            <img
              alt=""
              className={styles.boxSurface}
              src={sourceImageUrl}
              style={createCropPreviewSurfaceStyle(box, preview.bounds)}
            />
          )}
          {box.kind === "source" &&
            cropResizeCorners.map((corner) => (
              <span
                aria-hidden="true"
                className={clsx(
                  styles.resizeHandle,
                  resizeCornerClassNames[corner],
                )}
                data-corner={corner}
                data-region-id={box.id}
                key={corner}
                onPointerCancel={onResizePointerCancel}
                onPointerDown={onResizePointerDown}
                onPointerMove={onResizePointerMove}
                onPointerUp={onResizePointerUp}
              />
            ))}
        </div>
      ))}
      {preview.boxes.map((box) => (
        <span
          className={styles.boxLabel}
          key={`${box.id}-label`}
          style={createCropPreviewBoxLabelStyle(box, preview.bounds)}
          title={formatCropPreviewBoxLabel(box)}
        >
          {formatCropPreviewBoxLabel(box)}
        </span>
      ))}
    </>
  );
}

export { CropPreviewBoxLayer };
