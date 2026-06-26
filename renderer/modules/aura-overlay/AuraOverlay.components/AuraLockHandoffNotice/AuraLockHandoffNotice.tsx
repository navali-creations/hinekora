import { TbLockCheck } from "react-icons/tb";

import styles from "./AuraLockHandoffNotice.module.css";

function AuraLockHandoffNotice() {
  return (
    <div aria-live="polite" className={styles.lockHandoffNotice} role="status">
      <span className={`${styles.lockHandoffTitle} text-emerald-300`}>
        <TbLockCheck aria-hidden="true" className={styles.lockHandoffIcon} />
        Auras locked
      </span>
      <span className={styles.lockHandoffNote}>
        Click the game to resume control.
      </span>
    </div>
  );
}

export { AuraLockHandoffNotice };
