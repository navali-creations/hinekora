import {
  type OnboardingBeaconId,
  onboardingBeaconGroups,
} from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

import { BeaconManagementRow } from "./BeaconManagementRow/BeaconManagementRow";

interface BeaconManagementListProps {
  beaconStates: {
    id: string;
    dismissed: boolean;
  }[];
  onDismiss: (key: OnboardingBeaconId) => Promise<void> | void;
  onReset: (key: OnboardingBeaconId) => Promise<void> | void;
}

function BeaconManagementList({
  beaconStates,
  onDismiss,
  onReset,
}: BeaconManagementListProps) {
  const beaconStatesById = new Map(
    beaconStates.map((beacon) => [beacon.id, beacon.dismissed]),
  );

  return (
    <div
      className="grid gap-x-8 gap-y-5 xl:grid-cols-2"
      data-testid="beacon-management-list"
    >
      {onboardingBeaconGroups.map((group) => {
        const dismissedCount = group.beacons.filter(
          (beacon) => beaconStatesById.get(beacon.id) === true,
        ).length;

        return (
          <section
            className="min-w-0 rounded-md border border-base-content/8 bg-base-300/35 p-3"
            data-beacon-page={group.pageId}
            data-testid={`beacon-group-${group.pageId}`}
            key={group.pageId}
          >
            <div className="mb-1 flex items-center justify-between gap-3">
              <h4 className="truncate font-semibold text-sm">
                {group.pageLabel}
              </h4>
              <span className="badge badge-ghost badge-sm shrink-0">
                {dismissedCount} / {group.beacons.length} dismissed
              </span>
            </div>

            <div className="divide-y divide-base-content/10">
              {group.beacons.map((beacon) => {
                const dismissed = beaconStatesById.get(beacon.id) === true;
                const isVisible = !dismissed;

                return (
                  <BeaconManagementRow
                    beacon={beacon}
                    isVisible={isVisible}
                    key={beacon.id}
                    onDismiss={onDismiss}
                    onReset={onReset}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}

export { BeaconManagementList };
