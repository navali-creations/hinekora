import styles from "./AuraEditingNotice.module.css";

interface AuraEditingNoticeProps {
  addingAura: boolean;
  canAddAura: boolean;
  onAddAura: () => void;
  onLockAuras: () => void;
}

function AuraEditingNotice({
  addingAura,
  canAddAura,
  onAddAura,
  onLockAuras,
}: AuraEditingNoticeProps) {
  return (
    <div className={styles.editingNotice} role="status">
      <div className={styles.editingText}>
        <span className={styles.editingTitle}>Currently editing auras</span>
        <span className={styles.editingNote}>
          Add auras or lock to regain game control.
        </span>
      </div>
      <div className={styles.editingActions}>
        <button
          className={styles.addButton}
          disabled={!canAddAura || addingAura}
          type="button"
          onClick={onAddAura}
        >
          {addingAura ? "Selecting..." : "Add new aura"}
        </button>
        <button
          className={styles.lockButton}
          type="button"
          onClick={onLockAuras}
        >
          Lock auras
        </button>
      </div>
    </div>
  );
}

export { AuraEditingNotice };
