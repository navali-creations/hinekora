import { forwardRef, useImperativeHandle, useRef } from "react";

import type { AuraOverlayAreaSelectionBounds } from "../../AuraOverlay.hooks/useAuraOverlayAreaSelection/useAuraOverlayAreaSelection.utils";
import styles from "../AuraOverlayAreaSelection/AuraOverlayAreaSelection.module.css";

interface AuraOverlayAreaSelectionDraftHandle {
  clear: () => void;
  update: (bounds: AuraOverlayAreaSelectionBounds) => void;
}

const AuraOverlayAreaSelectionDraft =
  forwardRef<AuraOverlayAreaSelectionDraftHandle>(
    function AuraOverlayAreaSelectionDraft(_, ref) {
      const boxRef = useRef<HTMLDivElement>(null);

      useImperativeHandle(ref, () => ({
        clear: () => {
          if (boxRef.current) {
            boxRef.current.hidden = true;
          }
        },
        update: (bounds) => {
          const box = boxRef.current;
          if (!box) {
            return;
          }

          box.hidden = false;
          box.style.height = `${bounds.height}px`;
          box.style.left = `${bounds.x}px`;
          box.style.top = `${bounds.y}px`;
          box.style.width = `${bounds.width}px`;
        },
      }));

      return (
        <div
          aria-hidden="true"
          className={`${styles.selectionBox} ${styles.selectionBoxDraft}`}
          data-aura-area-selection-draft
          hidden
          ref={boxRef}
        />
      );
    },
  );

export type { AuraOverlayAreaSelectionDraftHandle };
export { AuraOverlayAreaSelectionDraft };
