import { FiLock } from "react-icons/fi";

import { OverlayNotice } from "~/renderer/components/OverlayNotice/OverlayNotice";
import { getAuraSelectionTypeHelp } from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";
import { useAuraOverlayShallow } from "~/renderer/store";

import { AuraOverlayControlsHelp } from "../AuraOverlayControlsHelp/AuraOverlayControlsHelp";
import { AuraOverlayEditingPreferences } from "../AuraOverlayEditingPreferences/AuraOverlayEditingPreferences";
import styles from "./AuraEditingNotice.module.css";

interface AuraEditingNoticeProps {
  canAddAura: boolean;
  onAddAura: () => void;
  onAddArchedAura: () => void;
  onAddPointerAura: () => void;
  onLockAuras: () => void;
}

const { Icon: DefaultAuraIcon } = getAuraSelectionTypeHelp("rect");
const { Icon: ArchedAuraIcon, iconClassName: archedAuraIconClassName } =
  getAuraSelectionTypeHelp("arc");
const { Icon: PointerAuraIcon } = getAuraSelectionTypeHelp("points");

function AuraEditingNotice({
  canAddAura,
  onAddAura,
  onAddArchedAura,
  onAddPointerAura,
  onLockAuras,
}: AuraEditingNoticeProps) {
  const { addingAuraShape, selectionError } = useAuraOverlayShallow(
    (auraOverlay) => ({
      addingAuraShape: auraOverlay.addingAuraShape,
      selectionError: auraOverlay.addAuraSelectionError,
    }),
  );
  const addingAura = addingAuraShape !== null;

  return (
    <>
      {addingAura && (
        <div aria-busy="true" className={styles.preparingOverlay}>
          <OverlayNotice className={styles.preparingNotice}>
            <span
              aria-hidden="true"
              className="loading loading-spinner loading-xs"
            />
            <span className="font-semibold">Preparing selection overlay…</span>
          </OverlayNotice>
        </div>
      )}
      {!addingAura && selectionError && (
        <OverlayNotice className={styles.selectionErrorNotice}>
          <span className="font-semibold">{selectionError}</span>
        </OverlayNotice>
      )}
      <div className={styles.editingDock}>
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
              <DefaultAuraIcon size={14} />
              <span>
                {addingAuraShape === "rect" ? "Selecting..." : "Add new aura"}
              </span>
            </button>
            <button
              className={styles.addButton}
              disabled={!canAddAura || addingAura}
              type="button"
              onClick={onAddArchedAura}
            >
              <ArchedAuraIcon className={archedAuraIconClassName} size={14} />
              <span>
                {addingAuraShape === "arc" ? "Selecting..." : "Add arched aura"}
              </span>
            </button>
            <button
              className={styles.addButton}
              disabled={!canAddAura || addingAura}
              type="button"
              onClick={onAddPointerAura}
            >
              <PointerAuraIcon size={14} />
              <span>
                {addingAuraShape === "points"
                  ? "Selecting..."
                  : "Add pointer aura"}
              </span>
            </button>
            <button
              className={styles.lockButton}
              disabled={addingAura}
              type="button"
              onClick={onLockAuras}
            >
              <FiLock size={14} />
              <span>Lock auras</span>
            </button>
          </div>
        </div>
        <AuraOverlayEditingPreferences />
        <AuraOverlayControlsHelp />
      </div>
    </>
  );
}

export { AuraEditingNotice };
