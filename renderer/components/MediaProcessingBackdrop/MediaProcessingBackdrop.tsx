import clsx from "clsx";

import styles from "./MediaProcessingBackdrop.module.css";

interface MediaProcessingBackdropProps {
  className?: string;
}

function MediaProcessingBackdrop({ className }: MediaProcessingBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(styles.root, className)}
      data-testid="media-processing-backdrop"
    >
      <div className={styles.dotField} />
      <div className={styles.dotGlow} />
    </div>
  );
}

export { MediaProcessingBackdrop };
