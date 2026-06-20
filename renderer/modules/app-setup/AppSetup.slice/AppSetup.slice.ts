import {
  getGameSelectionType,
  SETUP_STEPS,
  type SetupState,
  type StepValidationResult,
} from "~/main/modules/app-setup/AppSetup.types";
import { trackEvent } from "~/renderer/modules/umami";
import type {
  AppSetupSlice,
  BoundStoreStateCreator,
} from "~/renderer/store/store.types";

import type { AppSetupStep, GameId } from "~/types";

const gameOrder: GameId[] = ["poe1", "poe2"];

function sortGames(games: GameId[]): GameId[] {
  return [...games].sort(
    (left, right) => gameOrder.indexOf(left) - gameOrder.indexOf(right),
  );
}

export const createAppSetupSlice: BoundStoreStateCreator<AppSetupSlice> = (
  set,
  get,
) => ({
  appSetup: {
    setupState: null,
    validation: null,
    isLoading: false,
    error: null,
    setupStartTime: null,

    hydrate: async () => {
      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        const setupState = await window.electron.appSetup.getSetupState();
        set((state) => {
          state.appSetup.setupState = setupState;
          state.appSetup.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
      }
    },

    validateCurrentStep: async () => {
      try {
        const validation = await window.electron.appSetup.validateCurrentStep();
        set((state) => {
          state.appSetup.validation = validation;
        });
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Validation failed";
        });
      }
    },

    toggleGame: async (game: GameId) => {
      const previousSetupState = get().appSetup.setupState;
      const currentGames = previousSetupState?.selectedGames ?? [];
      const isSelected = currentGames.includes(game);
      const nextGames = isSelected
        ? currentGames.filter((currentGame) => currentGame !== game)
        : [...currentGames, game];

      if (nextGames.length === 0) {
        return;
      }

      const selectedGames = sortGames(nextGames);

      if (previousSetupState) {
        set((state) => {
          state.appSetup.setupState = {
            ...previousSetupState,
            selectedGames,
          };
          state.appSetup.validation = { isValid: true, errors: [] };
          state.appSetup.error = null;
        });
      }

      try {
        await get().settings.update({
          installedGames: selectedGames,
          activeGame: selectedGames[0] as GameId,
        });

        trackEvent("setup-game-toggled", {
          game,
          action: isSelected ? "removed" : "added",
          games: selectedGames,
          selection_type: getGameSelectionType(selectedGames),
        });
      } catch (error) {
        set((state) => {
          state.appSetup.setupState = previousSetupState;
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
        });
      }
    },

    selectClientPath: async (game: GameId, path: string) => {
      await get().clientLog.saveGamePath(game, path);

      const selectedGames = get().appSetup.setupState?.selectedGames ?? [];
      trackEvent("setup-client-path-selected", {
        game,
        has_path: true,
        selection_type: getGameSelectionType(selectedGames),
      });

      await get().appSetup.hydrate();
      await get().appSetup.validateCurrentStep();
    },

    advanceStep: async () => {
      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        const setupState = get().appSetup.setupState;
        const currentStep = setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED;
        const selectedGames = setupState?.selectedGames ?? [];
        const selectionType = getGameSelectionType(selectedGames);

        if (currentStep === SETUP_STEPS.SELECT_GAME) {
          trackEvent("setup-step-completed-game", {
            step_number: 1,
            step_name: "game",
            selectedGames,
            selection_type: selectionType,
          });
        }

        if (currentStep === SETUP_STEPS.SELECT_CLIENT_PATH) {
          trackEvent("setup-step-completed-client-path", {
            step_number: 2,
            step_name: "client-path",
            selectedGames,
            selection_type: selectionType,
          });
        }

        const result = await window.electron.appSetup.advanceStep();
        if (!result.success) {
          set((state) => {
            state.appSetup.error = result.error ?? "Failed to advance setup";
            state.appSetup.isLoading = false;
          });
          return false;
        }

        const nextSetupState = await window.electron.appSetup.getSetupState();
        set((state) => {
          state.appSetup.setupState = nextSetupState;
          state.appSetup.validation = null;
          state.appSetup.isLoading = false;
        });

        if (nextSetupState.currentStep === SETUP_STEPS.SELECT_CLIENT_PATH) {
          trackEvent("setup-step-viewed-client-path", {
            step_number: 2,
            step_name: "client-path",
            selectedGames: nextSetupState.selectedGames,
            selection_type: getGameSelectionType(nextSetupState.selectedGames),
          });
        }

        if (nextSetupState.currentStep === SETUP_STEPS.TELEMETRY_CONSENT) {
          trackEvent("setup-step-viewed-telemetry", {
            step_number: 3,
            step_name: "telemetry",
          });
        }

        return true;
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
        return false;
      }
    },

    goBack: async () => {
      const currentStep =
        get().appSetup.setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED;

      if (currentStep <= SETUP_STEPS.SELECT_GAME) {
        return;
      }

      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        const targetStep = (currentStep - 1) as AppSetupStep;
        const result = await window.electron.appSetup.goToStep(targetStep);

        if (!result.success) {
          set((state) => {
            state.appSetup.error = result.error ?? "Failed to go back";
            state.appSetup.isLoading = false;
          });
          return;
        }

        const setupState = await window.electron.appSetup.getSetupState();
        set((state) => {
          state.appSetup.setupState = setupState;
          state.appSetup.validation = null;
          state.appSetup.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
      }
    },

    completeSetup: async () => {
      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        const setupState = get().appSetup.setupState;
        const selectedGames = setupState?.selectedGames ?? [];
        const selectionType = getGameSelectionType(selectedGames);

        trackEvent("setup-step-completed-telemetry", {
          step_number: 3,
          step_name: "telemetry",
          selectedGames,
          selection_type: selectionType,
          crashReportingEnabled: setupState?.telemetryCrashReporting,
          usageAnalyticsEnabled: setupState?.telemetryUsageAnalytics,
        });

        const result = await window.electron.appSetup.completeSetup();
        if (!result.success) {
          set((state) => {
            state.appSetup.error = result.error ?? "Failed to complete setup";
            state.appSetup.isLoading = false;
          });
          return false;
        }

        const nextSetupState = await window.electron.appSetup.getSetupState();
        set((state) => {
          state.appSetup.setupState = nextSetupState;
          state.appSetup.isLoading = false;
        });

        trackEvent("setup-completed", {
          selectedGames,
          selection_type: selectionType,
          totalSteps: 3,
          timeTaken: get().appSetup.setupStartTime
            ? Date.now() - Number(get().appSetup.setupStartTime)
            : undefined,
          completion_status: "completed",
          crashReportingEnabled: setupState?.telemetryCrashReporting,
          usageAnalyticsEnabled: setupState?.telemetryUsageAnalytics,
        });

        return true;
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
        return false;
      }
    },

    skipSetup: async () => {
      const currentStep =
        get().appSetup.setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED;

      trackEvent("setup-skipped", {
        currentStep,
        completion_status: "skipped",
      });

      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        await window.electron.appSetup.skipSetup();
        await get().appSetup.hydrate();
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
      }
    },

    resetSetup: async () => {
      set((state) => {
        state.appSetup.isLoading = true;
        state.appSetup.error = null;
      });

      try {
        await window.electron.appSetup.resetSetup();
        await get().appSetup.hydrate();
        set((state) => {
          state.appSetup.validation = null;
          state.appSetup.isLoading = false;
        });
      } catch (error) {
        set((state) => {
          state.appSetup.error =
            error instanceof Error ? error.message : "Unknown error";
          state.appSetup.isLoading = false;
        });
      }
    },

    trackSetupStarted: () => {
      set((state) => {
        state.appSetup.setupStartTime = Date.now();
      });

      trackEvent("setup-started", {
        timestamp: new Date().toISOString(),
      });
    },

    setSetupState: (setupState: SetupState) => {
      set((state) => {
        state.appSetup.setupState = setupState;
      });
    },
    setValidation: (validation: StepValidationResult | null) => {
      set((state) => {
        state.appSetup.validation = validation;
      });
    },
    setError: (error: string | null) => {
      set((state) => {
        state.appSetup.error = error;
      });
    },
    isSetupComplete: () => get().appSetup.setupState?.isComplete ?? false,
    getCurrentStep: () =>
      get().appSetup.setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED,
    getSelectedGames: () => get().appSetup.setupState?.selectedGames ?? [],
  },
});
