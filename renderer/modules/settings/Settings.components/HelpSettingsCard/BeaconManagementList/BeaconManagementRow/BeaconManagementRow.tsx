import clsx from "clsx";
import type { ChangeEvent } from "react";

import type { OnboardingBeaconId } from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";

interface BeaconManagementRowProps {
  beacon: {
    id: OnboardingBeaconId;
    label: string;
  };
  isVisible: boolean;
  onDismiss: (key: OnboardingBeaconId) => Promise<void> | void;
  onReset: (key: OnboardingBeaconId) => Promise<void> | void;
}

function BeaconManagementRow({
  beacon,
  isVisible,
  onDismiss,
  onReset,
}: BeaconManagementRowProps) {
  const handleVisibilityChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.checked) {
      void onReset(beacon.id);
      return;
    }

    void onDismiss(beacon.id);
  };

  return (
    <div
      className="flex items-center justify-between gap-3 py-2"
      data-beacon-id={beacon.id}
      data-testid={`beacon-row-${beacon.id}`}
    >
      <span className="min-w-0 flex-1 truncate font-medium text-sm">
        {beacon.label}
      </span>
      <label className="flex shrink-0 items-center gap-2">
        <span
          className={clsx("font-medium text-xs", {
            "text-success": isVisible,
            "text-base-content/50": !isVisible,
          })}
        >
          {isVisible ? "Visible" : "Hidden"}
        </span>
        <input
          aria-label={`${isVisible ? "Dismiss" : "Show"} ${beacon.label} beacon`}
          checked={isVisible}
          className="toggle toggle-primary toggle-sm"
          type="checkbox"
          onChange={handleVisibilityChange}
        />
      </label>
    </div>
  );
}

export { BeaconManagementRow };
