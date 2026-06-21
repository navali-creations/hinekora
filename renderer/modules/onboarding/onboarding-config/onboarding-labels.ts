import {
  type OnboardingBeaconId,
  type OnboardingPageId,
  onboardingBeaconRegistry,
} from "./onboarding-registry";

interface OnboardingBeaconGroup {
  pageId: OnboardingPageId;
  pageLabel: string;
  beacons: {
    id: OnboardingBeaconId;
    label: string;
  }[];
}

interface OnboardingBeaconDefinition {
  pageId: OnboardingPageId;
  pageLabel: string;
  beaconId: OnboardingBeaconId;
  label: string;
}

const onboardingPageLabels = Object.fromEntries(
  onboardingBeaconRegistry.map((page) => [page.id, page.label]),
) as Record<OnboardingPageId, string>;

const onboardingBeaconLabels = Object.fromEntries(
  onboardingBeaconRegistry.flatMap((page) =>
    page.beacons.map((beacon) => [beacon.id, beacon.label]),
  ),
) as Record<OnboardingBeaconId, string>;

const onboardingBeaconGroups: OnboardingBeaconGroup[] =
  onboardingBeaconRegistry.map((page) => ({
    pageId: page.id,
    pageLabel: page.label,
    beacons: page.beacons.map((beacon) => ({
      id: beacon.id,
      label: beacon.label,
    })),
  }));

const allOnboardingBeaconIds = onboardingBeaconGroups.flatMap((group) =>
  group.beacons.map((beacon) => beacon.id),
);

const onboardingBeaconIdSet = new Set<string>(allOnboardingBeaconIds);

function sanitizeOnboardingBeaconIds(values: string[]): OnboardingBeaconId[] {
  const sanitizedIds: OnboardingBeaconId[] = [];
  const sanitizedIdSet = new Set<string>();

  for (const value of values) {
    if (!onboardingBeaconIdSet.has(value) || sanitizedIdSet.has(value)) {
      continue;
    }

    sanitizedIds.push(value as OnboardingBeaconId);
    sanitizedIdSet.add(value);
  }

  return sanitizedIds;
}

function getAllOnboardingBeaconDefinitions(): OnboardingBeaconDefinition[] {
  return onboardingBeaconGroups.flatMap((group) =>
    group.beacons.map((beacon) => ({
      pageId: group.pageId,
      pageLabel: group.pageLabel,
      beaconId: beacon.id,
      label: beacon.label,
    })),
  );
}

export {
  allOnboardingBeaconIds,
  getAllOnboardingBeaconDefinitions,
  type OnboardingBeaconDefinition,
  type OnboardingBeaconGroup,
  type OnboardingBeaconId,
  type OnboardingPageId,
  onboardingBeaconGroups,
  onboardingBeaconLabels,
  onboardingPageLabels,
  sanitizeOnboardingBeaconIds,
};
