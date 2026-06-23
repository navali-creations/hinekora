import styles from "./AuraLockHandoffNotice.module.css";

function AuraLockHandoffNotice() {
  return (
    <div aria-live="polite" className={styles.lockHandoffNotice} role="status">
      <span className={styles.lockHandoffTitle}>Auras locked</span>
      <span className={styles.lockHandoffNote}>
        Click the game to resume control.
      </span>
    </div>
  );
}

export { AuraLockHandoffNotice };
