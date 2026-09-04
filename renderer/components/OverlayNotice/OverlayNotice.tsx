import clsx from "clsx";
import type { HTMLAttributes } from "react";

import styles from "./OverlayNotice.module.css";

type OverlayNoticeProps = HTMLAttributes<HTMLDivElement>;

function OverlayNotice({ children, className, ...props }: OverlayNoticeProps) {
  return (
    <div
      {...props}
      aria-atomic="true"
      aria-live="polite"
      className={clsx(styles.notice, className)}
      role="status"
    >
      {children}
    </div>
  );
}

export { OverlayNotice };
