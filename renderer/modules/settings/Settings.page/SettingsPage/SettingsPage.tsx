import clsx from "clsx";
import { useEffect, useState } from "react";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import {
  type TabsBoxItem,
  TabsBoxTabs,
} from "~/renderer/components/TabsBoxTabs/TabsBoxTabs";
import { CaptureProfilesPanel } from "~/renderer/modules/capture-profiles/CaptureProfiles.components/CaptureProfilesPanel/CaptureProfilesPanel";
import { ProfilesPanel } from "~/renderer/modules/profiles/Profiles.components/ProfilesPanel/ProfilesPanel";

import { AppSettingsCard } from "../../Settings.components/AppSettingsCard/AppSettingsCard";
import { GameLogSettingsCard } from "../../Settings.components/GameLogSettingsCard/GameLogSettingsCard";
import { HelpSettingsCard } from "../../Settings.components/HelpSettingsCard/HelpSettingsCard";
import { PrivacySettingsCard } from "../../Settings.components/PrivacySettingsCard/PrivacySettingsCard";
import { ProfileTransferSettingsCard } from "../../Settings.components/ProfileTransferSettingsCard/ProfileTransferSettingsCard";
import { StorageSettingsCard } from "../../Settings.components/StorageSettingsCard/StorageSettingsCard";
import { TroubleshootingSettingsCard } from "../../Settings.components/TroubleshootingSettingsCard/TroubleshootingSettingsCard";

const settingsCategories = [
  "Game",
  "App",
  "Data & Storage",
  "Privacy",
  "Help",
  "Profiles",
  "Troubleshooting",
] as const;
type SettingsCategory = (typeof settingsCategories)[number];
const settingsCategoryBySlug = {
  app: "App",
  "data-storage": "Data & Storage",
  game: "Game",
  help: "Help",
  privacy: "Privacy",
  profiles: "Profiles",
  troubleshooting: "Troubleshooting",
} as const satisfies Record<string, SettingsCategory>;
type SettingsCategorySlug = keyof typeof settingsCategoryBySlug;
const getSettingsCategorySlug = (
  category: SettingsCategory,
): SettingsCategorySlug =>
  category
    .toLowerCase()
    .replace(/\s*&\s*/g, "-")
    .replace(/\s+/g, "-") as SettingsCategorySlug;
function getSettingsCategoryFromSlug(slug: unknown): SettingsCategory | null {
  if (typeof slug !== "string" || !(slug in settingsCategoryBySlug)) {
    return null;
  }

  return settingsCategoryBySlug[slug as SettingsCategorySlug];
}
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

interface SettingsPageProps {
  initialCategory?: SettingsCategory;
  onCategoryChange?: (category: SettingsCategory) => void;
}

function SettingsPage({
  initialCategory = "Game",
  onCategoryChange,
}: SettingsPageProps) {
  const [activeCategory, setActiveCategory] =
    useState<SettingsCategory>(initialCategory);

  useEffect(() => {
    setActiveCategory(initialCategory);
  }, [initialCategory]);

  const handleCategoryChange = (category: SettingsCategory) => {
    setActiveCategory(category);
    onCategoryChange?.(category);
  };

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
            onChange={handleCategoryChange}
          />
          <div
            aria-labelledby={`settings-tab-${getSettingsCategorySlug(activeCategory)}`}
            className="w-full bg-base-200 p-6"
            id={`settings-panel-${getSettingsCategorySlug(activeCategory)}`}
            role="tabpanel"
          >
            <div
              className={clsx({
                "grid gap-4": activeCategory === "Game",
                "grid grid-cols-12 items-start gap-3":
                  activeCategory !== "Game",
              })}
            >
              {activeCategory === "Game" && <GameLogSettingsCard />}
              {activeCategory === "App" && <AppSettingsCard />}
              {activeCategory === "Data & Storage" && <StorageSettingsCard />}
              {activeCategory === "Privacy" && <PrivacySettingsCard />}
              {activeCategory === "Help" && <HelpSettingsCard />}
              {activeCategory === "Profiles" && (
                <>
                  <div className="col-span-12 grid gap-3 lg:grid-cols-2">
                    <CaptureProfilesPanel />
                    <ProfilesPanel />
                  </div>
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

export type { SettingsCategory, SettingsCategorySlug };
export { getSettingsCategoryFromSlug, getSettingsCategorySlug, SettingsPage };
