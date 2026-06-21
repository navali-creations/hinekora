import { Beacons } from "@repere/react";
import { useLocation } from "@tanstack/react-router";

import { useOnboardingState } from "~/renderer/store";

import { onboardingConfig } from "../../onboarding-config/onboarding-config";

interface BeaconHostProps {
  enabled: boolean;
}

function BeaconHost({ enabled }: BeaconHostProps) {
  const location = useLocation();
  const { beaconHostRefreshKey } = useOnboardingState();

  return (
    <Beacons
      config={onboardingConfig}
      currentPath={location.pathname}
      enabled={enabled}
      key={beaconHostRefreshKey}
    />
  );
}

export { BeaconHost };
