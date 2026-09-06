import { FiChevronLeft } from "react-icons/fi";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";

function AuraPlacementPropertiesPanelToggle() {
  return (
    <summary
      aria-label="Collapse or expand aura properties"
      className={styles.propertiesPanelToggle}
    >
      <FiChevronLeft aria-hidden="true" size={14} />
    </summary>
  );
}

export { AuraPlacementPropertiesPanelToggle };
