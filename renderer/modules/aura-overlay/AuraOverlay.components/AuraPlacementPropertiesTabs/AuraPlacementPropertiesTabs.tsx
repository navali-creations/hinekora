import type { MouseEvent } from "react";

import styles from "../AuraOverlayPlacement/AuraOverlayPlacement.module.css";

type AuraPlacementPropertiesTab = "aura" | "general" | "icon";

interface AuraPlacementPropertiesTabsProps {
  activeTab: AuraPlacementPropertiesTab;
  showIconTab: boolean;
  onChange: (tab: AuraPlacementPropertiesTab) => void;
}

const tabs: ReadonlyArray<{
  label: string;
  value: AuraPlacementPropertiesTab;
}> = [
  { label: "General", value: "general" },
  { label: "Aura", value: "aura" },
  { label: "Icon", value: "icon" },
];

function isAuraPlacementPropertiesTab(
  value: string | undefined,
): value is AuraPlacementPropertiesTab {
  return value === "general" || value === "aura" || value === "icon";
}

function AuraPlacementPropertiesTabs({
  activeTab,
  showIconTab,
  onChange,
}: AuraPlacementPropertiesTabsProps) {
  const visibleTabs = tabs.filter((tab) => tab.value !== "icon" || showIconTab);
  const handleTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const nextTab = event.currentTarget.dataset.tab;
    if (isAuraPlacementPropertiesTab(nextTab)) {
      onChange(nextTab);
    }
  };

  return (
    <div
      aria-label="Aura property sections"
      className={styles.propertiesPanelTabs}
      role="tablist"
    >
      {visibleTabs.map((tab) => (
        <button
          aria-controls={`aura-properties-${tab.value}`}
          aria-selected={activeTab === tab.value}
          className={styles.propertiesPanelTab}
          data-tab={tab.value}
          key={tab.value}
          role="tab"
          type="button"
          onClick={handleTabClick}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export type { AuraPlacementPropertiesTab };
export { AuraPlacementPropertiesTabs };
