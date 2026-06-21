import { useCallback } from "react";

import { useBoundStore, useOnboardingActions } from "~/renderer/store";

function getDismissedBeaconSignature(): string {
  return useBoundStore.getState().onboarding.dismissedBeacons.join("|");
}

function useOnboardingMutationRefresh() {
  const { refreshBeaconHost } = useOnboardingActions();

  return useCallback(
    async (mutation: () => Promise<void>) => {
      const previousDismissed = getDismissedBeaconSignature();

      await mutation();

      const nextDismissed = getDismissedBeaconSignature();

      if (previousDismissed === nextDismissed) {
        return false;
      }

      refreshBeaconHost();
      return true;
    },
    [refreshBeaconHost],
  );
}

export { useOnboardingMutationRefresh };
