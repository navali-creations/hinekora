const onboardingBeaconRegistry = [
  {
    id: "all-pages",
    label: "All Pages",
    path: "*",
    beacons: [
      {
        id: "game-selector",
        label: "Game selector",
        selector: "[data-onboarding='game-selector']",
      },
      {
        id: "overlay-icon",
        label: "Overlay icon",
        selector: "[data-onboarding='overlay-icon']",
      },
    ],
  },
  {
    id: "dashboard",
    label: "Dashboard",
    path: "/",
    beacons: [
      {
        id: "capture-mode",
        label: "Capture mode",
        selector: "[data-onboarding='capture-mode']",
      },
      {
        id: "capture-profiles",
        label: "Capture profiles",
        selector: "[data-onboarding='capture-profiles']",
      },
      {
        id: "start-recording",
        label: "Start recording",
        selector: "[data-onboarding='start-recording']",
      },
      {
        id: "capture-source",
        label: "Capture source",
        selector: "[data-onboarding='capture-source']",
      },
      {
        id: "capture-settings",
        label: "Capture settings",
        selector: "[data-onboarding='capture-settings']",
      },
    ],
  },
  {
    id: "aura-manager",
    label: "Aura Manager",
    path: "/crop-overlay",
    beacons: [
      {
        id: "aura-profile-select",
        label: "Aura profile",
        selector: "[data-onboarding='aura-profile-select']",
      },
      {
        id: "aura-lock-toggle",
        label: "Lock and unlock",
        selector: "[data-onboarding='aura-lock-toggle']",
      },
      {
        id: "aura-new-aura",
        label: "New aura",
        selector: "[data-onboarding='aura-new-aura']",
      },
      {
        id: "aura-source-position",
        label: "Source and position",
        selector: "[data-onboarding='aura-source-position']",
      },
    ],
  },
  {
    id: "editor",
    label: "Editor",
    path: "/editor",
    beacons: [
      {
        id: "editor-my-media",
        label: "My media",
        selector: "[data-onboarding='editor-my-media']",
      },
      {
        id: "editor-preview-source",
        label: "Preview source",
        selector: "[data-onboarding='editor-preview-source']",
      },
      {
        id: "editor-profiles",
        label: "Profiles",
        selector: "[data-onboarding='editor-profiles']",
      },
      {
        id: "editor-more-options",
        label: "More options",
        selector: "[data-onboarding='editor-more-options']",
      },
      {
        id: "editor-timeline",
        label: "Timeline",
        selector: "[data-onboarding='editor-timeline']",
      },
    ],
  },
] as const;

type OnboardingPageRegistryEntry = (typeof onboardingBeaconRegistry)[number];
type OnboardingPageId = OnboardingPageRegistryEntry["id"];
type OnboardingBeaconRegistryEntry =
  OnboardingPageRegistryEntry["beacons"][number];
type OnboardingBeaconId = OnboardingBeaconRegistryEntry["id"];

export {
  type OnboardingBeaconId,
  type OnboardingBeaconRegistryEntry,
  type OnboardingPageId,
  type OnboardingPageRegistryEntry,
  onboardingBeaconRegistry,
};
