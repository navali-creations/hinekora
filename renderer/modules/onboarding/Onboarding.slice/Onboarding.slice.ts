import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import {
  allOnboardingBeaconIds,
  sanitizeOnboardingBeaconIds,
} from "../onboarding-config/onboarding-labels";

interface OnboardingSlice {
  onboarding: {
    dismissedBeacons: string[];
    isLoading: boolean;
    error: string | null;
    beaconHostRefreshKey: number;
    hydrate: () => Promise<void>;
    isDismissed: (key: string) => boolean;
    dismiss: (key: string) => Promise<void>;
    dismissAll: () => Promise<void>;
    reset: (key: string) => Promise<void>;
    resetOne: (key: string) => Promise<void>;
    resetAll: () => Promise<void>;
    refreshBeaconHost: () => void;
    getAllBeaconStates: () => { id: string; dismissed: boolean }[];
  };
}

const uniqueOnboardingBeaconIds = [...new Set(allOnboardingBeaconIds)];

function areArraysEqual(left: string[], right: string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

const createOnboardingSlice: BoundStoreStateCreator<OnboardingSlice> = (
  set,
  get,
) => {
  let dismissedBeaconsMutationQueue = Promise.resolve();

  const enqueueDismissedBeaconsMutation = async ({
    computeNext,
    successAction,
    errorAction,
    errorMessage,
  }: {
    computeNext: (current: string[]) => string[];
    successAction: string;
    errorAction: string;
    errorMessage: string;
  }) => {
    dismissedBeaconsMutationQueue = dismissedBeaconsMutationQueue.then(
      async () => {
        const currentDismissed = get().onboarding.dismissedBeacons;
        const nextDismissed = sanitizeOnboardingBeaconIds(
          computeNext(currentDismissed),
        );

        if (areArraysEqual(currentDismissed, nextDismissed)) {
          return;
        }

        try {
          await window.electron.settings.update?.({
            onboardingDismissedBeacons: nextDismissed,
          });

          set(
            ({ onboarding }) => {
              onboarding.dismissedBeacons = nextDismissed;
            },
            false,
            successAction,
          );
        } catch (error) {
          console.error(errorMessage, error);
          set(
            ({ onboarding }) => {
              onboarding.error =
                error instanceof Error ? error.message : errorMessage;
            },
            false,
            errorAction,
          );
        }
      },
    );

    await dismissedBeaconsMutationQueue;
  };

  return {
    onboarding: {
      dismissedBeacons: [],
      isLoading: false,
      error: null,
      beaconHostRefreshKey: 0,

      hydrate: async () => {
        set(
          ({ onboarding }) => {
            onboarding.isLoading = true;
            onboarding.error = null;
          },
          false,
          "onboarding/hydrate/start",
        );

        try {
          const settings = await window.electron.settings.get();
          const persistedDismissed =
            "onboardingDismissedBeacons" in settings &&
            Array.isArray(settings.onboardingDismissedBeacons)
              ? settings.onboardingDismissedBeacons
              : [];
          const sanitizedDismissed =
            sanitizeOnboardingBeaconIds(persistedDismissed);

          if (!areArraysEqual(persistedDismissed, sanitizedDismissed)) {
            try {
              await window.electron.settings.update?.({
                onboardingDismissedBeacons: sanitizedDismissed,
              });
            } catch (error) {
              console.error(
                "Failed to clean up persisted onboarding beacons:",
                error,
              );
            }
          }

          set(
            ({ onboarding }) => {
              onboarding.dismissedBeacons = sanitizedDismissed;
              onboarding.isLoading = false;
            },
            false,
            "onboarding/hydrate/success",
          );
        } catch (error) {
          console.error("Failed to hydrate onboarding state:", error);
          set(
            ({ onboarding }) => {
              onboarding.error =
                error instanceof Error ? error.message : "Unknown error";
              onboarding.isLoading = false;
            },
            false,
            "onboarding/hydrate/error",
          );
        }
      },

      isDismissed: (key: string) =>
        get().onboarding.dismissedBeacons.includes(key),

      dismiss: async (key: string) => {
        await enqueueDismissedBeaconsMutation({
          computeNext: (currentDismissed) => {
            if (currentDismissed.includes(key)) {
              return currentDismissed;
            }

            return [...currentDismissed, key];
          },
          successAction: "onboarding/dismiss",
          errorAction: "onboarding/dismiss/error",
          errorMessage: "Failed to dismiss beacon",
        });
      },

      dismissAll: async () => {
        await enqueueDismissedBeaconsMutation({
          computeNext: () => uniqueOnboardingBeaconIds,
          successAction: "onboarding/dismissAll",
          errorAction: "onboarding/dismissAll/error",
          errorMessage: "Failed to dismiss all beacons",
        });
      },

      reset: async (key: string) => {
        await enqueueDismissedBeaconsMutation({
          computeNext: (currentDismissed) =>
            currentDismissed.filter((dismissedKey) => dismissedKey !== key),
          successAction: "onboarding/reset",
          errorAction: "onboarding/reset/error",
          errorMessage: "Failed to reset beacon",
        });
      },

      resetOne: async (key: string) => {
        await get().onboarding.reset(key);
      },

      resetAll: async () => {
        await enqueueDismissedBeaconsMutation({
          computeNext: () => [],
          successAction: "onboarding/resetAll",
          errorAction: "onboarding/resetAll/error",
          errorMessage: "Failed to reset all beacons",
        });
      },

      refreshBeaconHost: () => {
        set(
          ({ onboarding }) => {
            onboarding.beaconHostRefreshKey += 1;
          },
          false,
          "onboarding/refreshBeaconHost",
        );
      },

      getAllBeaconStates: () => {
        const dismissed = new Set(get().onboarding.dismissedBeacons);

        return uniqueOnboardingBeaconIds.map((id) => ({
          id,
          dismissed: dismissed.has(id),
        }));
      },
    },
  };
};

export { createOnboardingSlice, type OnboardingSlice };
