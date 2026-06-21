import type { BeaconState, BeaconStore } from "@repere/react";

import { useBoundStore } from "~/renderer/store";

const repereStoreAdapter: BeaconStore = {
  isDismissed: (beaconId: string): boolean =>
    useBoundStore.getState().onboarding.isDismissed(beaconId),

  dismiss: (beaconId: string): void => {
    void useBoundStore.getState().onboarding.dismiss(beaconId);
  },

  reset: (beaconId: string): void => {
    void useBoundStore.getState().onboarding.reset(beaconId);
  },

  resetAll: (): void => {
    void useBoundStore.getState().onboarding.resetAll();
  },

  getAll: (): BeaconState[] =>
    useBoundStore
      .getState()
      .onboarding.getAllBeaconStates()
      .map(({ id, dismissed }) => ({
        id,
        isDismissed: dismissed,
      })),
};

export { repereStoreAdapter };
