import clsx from "clsx";
import { useState } from "react";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  type TabsBoxItem,
  TabsBoxTabs,
} from "~/renderer/components/TabsBoxTabs/TabsBoxTabs";
import { ProfilesPanel } from "~/renderer/modules/profiles/Profiles.components/ProfilesPanel/ProfilesPanel";

import { AppSettingsCard } from "../../Settings.components/AppSettingsCard/AppSettingsCard";
import { GameLogSettingsCard } from "../../Settings.components/GameLogSettingsCard/GameLogSettingsCard";
import { PrivacySettingsCard } from "../../Settings.components/PrivacySettingsCard/PrivacySettingsCard";
import { ProfileTransferSettingsCard } from "../../Settings.components/ProfileTransferSettingsCard/ProfileTransferSettingsCard";
import { StorageSettingsCard } from "../../Settings.components/StorageSettingsCard/StorageSettingsCard";
import { TroubleshootingSettingsCard } from "../../Settings.components/TroubleshootingSettingsCard/TroubleshootingSettingsCard";

const settingsCategories = [
  "Game",
  "App",
  "Data & Storage",
  "Privacy",
  "Profiles",
  "Troubleshooting",
] as const;
type SettingsCategory = (typeof settingsCategories)[number];
const getSettingsCategorySlug = (category: SettingsCategory) =>
  category
    .toLowerCase()
    .replace(/\s*&\s*/g, "-")
    .replace(/\s+/g, "-");
const settingsTabItems: TabsBoxItem<SettingsCategory>[] =
  settingsCategories.map((category) => {
    const categorySlug = getSettingsCategorySlug(category);

    return {
      value: category,
      label: category,
      tabId: `settings-tab-${categorySlug}`,
      panelId: `settings-panel-${categorySlug}`,
    };
  });

function SettingsPage() {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>("Game");

  return (
    <PageContainer>
      <PageHeader
        title="Settings"
        subtitle="Configure your application preferences and game paths"
      />
      <PageContent>
        <section
          aria-label="Settings sections"
          className="tabs tabs-box max-w-5xl bg-base-200 p-1"
          role="tablist"
        >
          <TabsBoxTabs
            items={settingsTabItems}
            value={activeCategory}
            onChange={setActiveCategory}
          />
          <div
            aria-labelledby={`settings-tab-${getSettingsCategorySlug(activeCategory)}`}
            className="w-full bg-base-200 p-6"
            id={`settings-panel-${getSettingsCategorySlug(activeCategory)}`}
            role="tabpanel"
          >
            <div
              className={clsx(
                activeCategory === "Game"
                  ? "grid gap-4"
                  : "grid grid-cols-12 items-start gap-3",
              )}
            >
              {activeCategory === "Game" && <GameLogSettingsCard />}
              {activeCategory === "App" && <AppSettingsCard />}
              {activeCategory === "Data & Storage" && <StorageSettingsCard />}
              {activeCategory === "Privacy" && <PrivacySettingsCard />}
              {activeCategory === "Profiles" && (
                <>
                  <ProfilesPanel />
                  <ProfileTransferSettingsCard />
                </>
              )}
              {activeCategory === "Troubleshooting" && (
                <TroubleshootingSettingsCard />
              )}
            </div>
          </div>
        </section>
      </PageContent>
    </PageContainer>
  );
}

export { SettingsPage };
