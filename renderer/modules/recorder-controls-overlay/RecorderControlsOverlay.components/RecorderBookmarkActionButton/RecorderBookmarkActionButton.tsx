import clsx from "clsx";
import { FiBookmark as Bookmark, FiCheck as Check } from "react-icons/fi";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

interface RecorderBookmarkActionButtonProps {
  disabled: boolean;
  isSaved: boolean;
  onClick: () => void;
}

function RecorderBookmarkActionButton({
  disabled,
  isSaved,
  onClick,
}: RecorderBookmarkActionButtonProps) {
  return (
    <button
      aria-label="Add bookmark"
      className={clsx(
        styles.iconButton,
        "btn btn-square",
        isSaved ? "btn-success" : "btn-primary",
      )}
      disabled={disabled}
      title="Add bookmark"
      type="button"
      onClick={onClick}
    >
      {isSaved ? <Check size={18} /> : <Bookmark size={18} />}
    </button>
  );
}

export { RecorderBookmarkActionButton };
