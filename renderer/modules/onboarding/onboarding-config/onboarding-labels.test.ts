import { describe, expect, it } from "vitest";

import { onboardingConfig } from "./onboarding-config";
import {
  allOnboardingBeaconIds,
  getAllOnboardingBeaconDefinitions,
  onboardingBeaconGroups,
} from "./onboarding-labels";

describe("onboarding labels", () => {
  it("keeps grouped beacon definitions in sync", () => {
    expect(allOnboardingBeaconIds).toEqual([
      "game-selector",
      "overlay-icon",
      "capture-mode",
      "start-recording",
      "capture-source",
      "capture-settings",
      "aura-profile-select",
      "aura-lock-toggle",
      "aura-new-aura",
      "aura-source-position",
      "editor-my-media",
      "editor-preview-source",
      "editor-profiles",
      "editor-more-options",
      "editor-timeline",
    ]);
    expect(getAllOnboardingBeaconDefinitions()).toHaveLength(
      allOnboardingBeaconIds.length,
    );
    expect(onboardingBeaconGroups[1]?.pageLabel).toBe("Dashboard");
    expect(onboardingBeaconGroups[2]?.pageLabel).toBe("Aura Manager");
    expect(onboardingBeaconGroups[3]?.pageLabel).toBe("Editor");
  });

  it("matches the Repere page and beacon config", () => {
    const configuredPageIds = onboardingConfig.pages.map((page) => page.id);
    const configuredBeaconIds = onboardingConfig.pages.flatMap((page) =>
      page.beacons.map((beacon) => beacon.id),
    );

    expect(configuredPageIds).toEqual(
      onboardingBeaconGroups.map((group) => group.pageId),
    );
    expect(configuredBeaconIds).toEqual(allOnboardingBeaconIds);
  });
});
