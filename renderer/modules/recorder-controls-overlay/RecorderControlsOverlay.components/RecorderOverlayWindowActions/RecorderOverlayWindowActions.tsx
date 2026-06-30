import { FiMinimize2 as Minimize, FiX as X } from "react-icons/fi";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

interface RecorderOverlayWindowActionsProps {
  onClose: () => void;
  onMinimize: () => void;
}

function RecorderOverlayWindowActions({
  onClose,
  onMinimize,
}: RecorderOverlayWindowActionsProps) {
  return (
    <div className="flex gap-1">
      <button
        aria-label="Minimize overlay"
        className={`${styles.windowButton} btn btn-ghost btn-square`}
        title="Minimize overlay"
        type="button"
        onClick={onMinimize}
      >
        <Minimize size={15} />
      </button>
      <button
        aria-label="Close overlay"
        className={`${styles.windowButton} btn btn-ghost btn-square`}
        title="Close overlay"
        type="button"
        onClick={onClose}
      >
        <X size={15} />
      </button>
    </div>
  );
}

export { RecorderOverlayWindowActions };
