import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  SETUP_STEPS,
  type SetupState,
} from "~/main/modules/app-setup/AppSetup.types";
import type { BoundStore } from "~/renderer/store/store.types";
import { createBoundStoreForTests } from "~/renderer/test/createBoundStoreForTests";

import { createAppSetupSlice } from "./AppSetup.slice";

const umamiMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

vi.mock("~/renderer/modules/umami", () => umamiMocks);

function createSetupState(
  selectedGames: SetupState["selectedGames"],
  overrides: Partial<SetupState> = {},
) {
  return {
    currentStep: SETUP_STEPS.SELECT_GAME,
    isComplete: false,
    selectedGames,
    poe1ClientPath: null,
    poe2ClientPath: null,
    telemetryCrashReporting: false,
    telemetryUsageAnalytics: false,
    ...overrides,
  } satisfies SetupState;
}

function createTestStore({
  selectedGames = ["poe1"],
  setupState,
  updateSettings = vi.fn().mockResolvedValue(undefined),
  hydrateSettings = vi.fn().mockResolvedValue(undefined),
  saveGamePath = vi.fn().mockResolvedValue(undefined),
}: {
  selectedGames?: SetupState["selectedGames"];
  setupState?: SetupState | null;
  updateSettings?: ReturnType<typeof vi.fn>;
  hydrateSettings?: ReturnType<typeof vi.fn>;
  saveGamePath?: ReturnType<typeof vi.fn>;
} = {}) {
  const store = createBoundStoreForTests((set, get, api) => {
    const appSetupSlice = createAppSetupSlice(set, get, api);

    return {
      ...appSetupSlice,
      settings: {
        value: null,
        hydrate: hydrateSettings,
        update: updateSettings,
      },
      clientLog: {
        hydrate: vi.fn(),
        pendingPath: "",
        saveGamePath,
        savePath: vi.fn(),
        setActiveGame: vi.fn(),
        setPendingPath: vi.fn(),
        startListening: vi.fn(),
        status: null,
      },
    } as unknown as BoundStore;
  });

  store.setState((state) => ({
    appSetup: {
      ...state.appSetup,
      setupState:
        setupState === undefined ? createSetupState(selectedGames) : setupState,
    },
  }));

  return { hydrateSettings, saveGamePath, store, updateSettings };
}

describe("AppSetup slice", () => {
  const advanceStep = vi.fn();
  const completeSetup = vi.fn();
  const getSetupState = vi.fn();
  const goToStep = vi.fn();
  const resetSetup = vi.fn();
  const skipSetup = vi.fn();
  const validateCurrentStep = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-18T12:00:00.000Z"));
    advanceStep.mockResolvedValue({ success: true });
    completeSetup.mockResolvedValue({ success: true });
    getSetupState.mockResolvedValue(createSetupState(["poe1"]));
    goToStep.mockResolvedValue({ success: true });
    resetSetup.mockResolvedValue(undefined);
    skipSetup.mockResolvedValue(undefined);
    validateCurrentStep.mockResolvedValue({ isValid: true, errors: [] });

    Object.defineProperty(window, "electron", {
      configurable: true,
      value: {
        appSetup: {
          advanceStep,
          completeSetup,
          getSetupState,
          goToStep,
          resetSetup,
          skipSetup,
          validateCurrentStep,
        },
      },
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("toggles selected games without entering the loading state", async () => {
    const { store, updateSettings } = createTestStore();

    await store.getState().appSetup.toggleGame("poe2");

    expect(store.getState().appSetup.isLoading).toBe(false);
    expect(store.getState().appSetup.setupState?.selectedGames).toEqual([
      "poe1",
      "poe2",
    ]);
    expect(store.getState().appSetup.validation).toEqual({
      isValid: true,
      errors: [],
    });
    expect(updateSettings).toHaveBeenCalledWith({
      installedGames: ["poe1", "poe2"],
      activeGame: "poe1",
    });
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith("setup-game-toggled", {
      game: "poe2",
      action: "added",
      games: ["poe1", "poe2"],
      selection_type: "both",
    });
  });

  it("removes selected games and tracks removal", async () => {
    const { store, updateSettings } = createTestStore({
      selectedGames: ["poe1", "poe2"],
    });

    await store.getState().appSetup.toggleGame("poe2");

    expect(store.getState().appSetup.setupState?.selectedGames).toEqual([
      "poe1",
    ]);
    expect(updateSettings).toHaveBeenCalledWith({
      installedGames: ["poe1"],
      activeGame: "poe1",
    });
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith("setup-game-toggled", {
      game: "poe2",
      action: "removed",
      games: ["poe1"],
      selection_type: "poe1_only",
    });
  });

  it("reverts selected games when persistence fails", async () => {
    const updateSettings = vi.fn().mockRejectedValue(new Error("write failed"));
    const { store } = createTestStore({ updateSettings });

    await store.getState().appSetup.toggleGame("poe2");

    expect(store.getState().appSetup.isLoading).toBe(false);
    expect(store.getState().appSetup.setupState?.selectedGames).toEqual([
      "poe1",
    ]);
    expect(store.getState().appSetup.error).toBe("write failed");
    expect(umamiMocks.trackEvent).not.toHaveBeenCalled();
  });

  it("stores unknown persistence errors when game selection save fails", async () => {
    const updateSettings = vi.fn().mockRejectedValue("bad");
    const { store } = createTestStore({ updateSettings });

    await store.getState().appSetup.toggleGame("poe2");

    expect(store.getState().appSetup.error).toBe("Unknown error");
    expect(store.getState().appSetup.setupState?.selectedGames).toEqual([
      "poe1",
    ]);
  });

  it("skips removing the final selected game", async () => {
    const { store, updateSettings } = createTestStore();

    await store.getState().appSetup.toggleGame("poe1");

    expect(updateSettings).not.toHaveBeenCalled();
    expect(store.getState().appSetup.setupState?.selectedGames).toEqual([
      "poe1",
    ]);
  });

  it("toggles games even before setup state is hydrated", async () => {
    const { store, updateSettings } = createTestStore({ setupState: null });

    await store.getState().appSetup.toggleGame("poe2");

    expect(updateSettings).toHaveBeenCalledWith({
      activeGame: "poe2",
      installedGames: ["poe2"],
    });
    expect(store.getState().appSetup.setupState).toBeNull();
  });

  it("hydrates setup state and stores hydrate errors", async () => {
    const setupState = createSetupState(["poe1", "poe2"], {
      currentStep: SETUP_STEPS.SELECT_CLIENT_PATH,
    });
    getSetupState
      .mockResolvedValueOnce(setupState)
      .mockRejectedValueOnce("bad");
    const { store } = createTestStore();

    await store.getState().appSetup.hydrate();
    expect(store.getState().appSetup).toMatchObject({
      error: null,
      isLoading: false,
      setupState,
    });

    await store.getState().appSetup.hydrate();
    expect(store.getState().appSetup).toMatchObject({
      error: "Unknown error",
      isLoading: false,
    });

    getSetupState.mockRejectedValueOnce(new Error("load failed"));
    await store.getState().appSetup.hydrate();
    expect(store.getState().appSetup.error).toBe("load failed");
  });

  it("validates current setup step and stores validation errors", async () => {
    validateCurrentStep
      .mockResolvedValueOnce({ isValid: false, errors: ["Missing path"] })
      .mockRejectedValueOnce("bad");
    const { store } = createTestStore();

    await store.getState().appSetup.validateCurrentStep();
    expect(store.getState().appSetup.validation).toEqual({
      errors: ["Missing path"],
      isValid: false,
    });

    await store.getState().appSetup.validateCurrentStep();
    expect(store.getState().appSetup.error).toBe("Validation failed");

    validateCurrentStep.mockRejectedValueOnce(new Error("invalid"));
    await store.getState().appSetup.validateCurrentStep();
    expect(store.getState().appSetup.error).toBe("invalid");
  });

  it("selects client paths then rehydrates and validates setup", async () => {
    const saveGamePath = vi.fn().mockResolvedValue(undefined);
    const { store } = createTestStore({
      saveGamePath,
      selectedGames: ["poe1", "poe2"],
    });

    await store
      .getState()
      .appSetup.selectClientPath("poe2", "C:\\PoE2\\Client.txt");

    expect(saveGamePath).toHaveBeenCalledWith("poe2", "C:\\PoE2\\Client.txt");
    expect(getSetupState).toHaveBeenCalled();
    expect(validateCurrentStep).toHaveBeenCalled();
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-client-path-selected",
      {
        game: "poe2",
        has_path: true,
        selection_type: "both",
      },
    );
  });

  it("tracks client path selection without a hydrated setup state", async () => {
    const { store } = createTestStore({ setupState: null });

    await store
      .getState()
      .appSetup.selectClientPath("poe1", "C:\\PoE\\Client.txt");

    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-client-path-selected",
      {
        game: "poe1",
        has_path: true,
        selection_type: "poe1_only",
      },
    );
  });

  it("advances setup steps and tracks viewed next steps", async () => {
    const nextClientPathState = createSetupState(["poe1"], {
      currentStep: SETUP_STEPS.SELECT_CLIENT_PATH,
    });
    const nextTelemetryState = createSetupState(["poe1"], {
      currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });
    getSetupState
      .mockResolvedValueOnce(nextClientPathState)
      .mockResolvedValueOnce(nextTelemetryState);
    const { store } = createTestStore();

    await expect(store.getState().appSetup.advanceStep()).resolves.toBe(true);
    store.getState().appSetup.setSetupState(nextClientPathState);
    await expect(store.getState().appSetup.advanceStep()).resolves.toBe(true);

    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-step-completed-game",
      expect.objectContaining({ step_name: "game" }),
    );
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-step-viewed-client-path",
      expect.objectContaining({ step_name: "client-path" }),
    );
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-step-completed-client-path",
      expect.objectContaining({ step_name: "client-path" }),
    );
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-step-viewed-telemetry",
      expect.objectContaining({ step_name: "telemetry" }),
    );
  });

  it("handles failed and thrown advance step results", async () => {
    const { store } = createTestStore({ setupState: null });
    advanceStep
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce("bad");

    await expect(store.getState().appSetup.advanceStep()).resolves.toBe(false);
    expect(store.getState().appSetup.error).toBe("Failed to advance setup");

    await expect(store.getState().appSetup.advanceStep()).resolves.toBe(false);
    expect(store.getState().appSetup.error).toBe("Unknown error");

    advanceStep.mockRejectedValueOnce(new Error("advance failed"));
    await expect(store.getState().appSetup.advanceStep()).resolves.toBe(false);
    expect(store.getState().appSetup.error).toBe("advance failed");
  });

  it("goes back unless already on the first step", async () => {
    const previousState = createSetupState(["poe1"], {
      currentStep: SETUP_STEPS.SELECT_GAME,
    });
    getSetupState.mockResolvedValueOnce(previousState);
    const { store } = createTestStore({
      setupState: createSetupState(["poe1"], {
        currentStep: SETUP_STEPS.SELECT_CLIENT_PATH,
      }),
    });

    await store.getState().appSetup.goBack();
    expect(goToStep).toHaveBeenCalledWith(SETUP_STEPS.SELECT_GAME);
    expect(store.getState().appSetup.setupState).toBe(previousState);

    await store.getState().appSetup.goBack();
    expect(goToStep).toHaveBeenCalledTimes(1);
  });

  it("ignores go back before setup state is hydrated", async () => {
    const { store } = createTestStore({ setupState: null });

    await store.getState().appSetup.goBack();

    expect(goToStep).not.toHaveBeenCalled();
  });

  it("handles failed and thrown go back results", async () => {
    const { store } = createTestStore({
      setupState: createSetupState(["poe1"], {
        currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
      }),
    });
    goToStep
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce("bad");

    await store.getState().appSetup.goBack();
    expect(store.getState().appSetup.error).toBe("Failed to go back");

    await store.getState().appSetup.goBack();
    expect(store.getState().appSetup.error).toBe("Unknown error");

    goToStep.mockRejectedValueOnce(new Error("back failed"));
    await store.getState().appSetup.goBack();
    expect(store.getState().appSetup.error).toBe("back failed");
  });

  it("completes setup and tracks elapsed setup time", async () => {
    const completedState = createSetupState(["poe1", "poe2"], {
      currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
      isComplete: true,
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
    });
    getSetupState.mockResolvedValueOnce(completedState);
    const { store } = createTestStore({ setupState: completedState });
    store.getState().appSetup.trackSetupStarted();
    vi.setSystemTime(new Date("2026-06-18T12:00:05.000Z"));

    await expect(store.getState().appSetup.completeSetup()).resolves.toBe(true);

    expect(store.getState().appSetup.setupState).toBe(completedState);
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-completed",
      expect.objectContaining({
        completion_status: "completed",
        selection_type: "both",
        timeTaken: 5000,
      }),
    );
  });

  it("handles failed and thrown complete setup results", async () => {
    const { store } = createTestStore({ setupState: null });
    completeSetup
      .mockResolvedValueOnce({ success: false })
      .mockRejectedValueOnce("bad");

    await expect(store.getState().appSetup.completeSetup()).resolves.toBe(
      false,
    );
    expect(store.getState().appSetup.error).toBe("Failed to complete setup");

    await expect(store.getState().appSetup.completeSetup()).resolves.toBe(
      false,
    );
    expect(store.getState().appSetup.error).toBe("Unknown error");

    completeSetup.mockRejectedValueOnce(new Error("complete failed"));
    await expect(store.getState().appSetup.completeSetup()).resolves.toBe(
      false,
    );
    expect(store.getState().appSetup.error).toBe("complete failed");
  });

  it("completes setup without an elapsed start time", async () => {
    const setupState = createSetupState(["poe1"]);
    getSetupState.mockResolvedValueOnce(setupState);
    const { store } = createTestStore({ setupState });

    await expect(store.getState().appSetup.completeSetup()).resolves.toBe(true);

    expect(umamiMocks.trackEvent).toHaveBeenCalledWith(
      "setup-completed",
      expect.objectContaining({
        timeTaken: undefined,
      }),
    );
  });

  it("skips and resets setup through hydrate", async () => {
    const { store } = createTestStore({
      setupState: createSetupState(["poe1"], {
        currentStep: SETUP_STEPS.SELECT_CLIENT_PATH,
      }),
    });
    store.getState().appSetup.setValidation({ isValid: false, errors: ["x"] });

    await store.getState().appSetup.skipSetup();
    await store.getState().appSetup.resetSetup();

    expect(skipSetup).toHaveBeenCalled();
    expect(resetSetup).toHaveBeenCalled();
    expect(store.getState().appSetup.validation).toBeNull();
    expect(store.getState().appSetup.isLoading).toBe(false);
    expect(umamiMocks.trackEvent).toHaveBeenCalledWith("setup-skipped", {
      completion_status: "skipped",
      currentStep: SETUP_STEPS.SELECT_CLIENT_PATH,
    });
  });

  it("tracks skipped setup before setup state is hydrated", async () => {
    const { store } = createTestStore({ setupState: null });

    await store.getState().appSetup.skipSetup();

    expect(umamiMocks.trackEvent).toHaveBeenCalledWith("setup-skipped", {
      completion_status: "skipped",
      currentStep: SETUP_STEPS.NOT_STARTED,
    });
  });

  it("stores skip and reset failures", async () => {
    const { store } = createTestStore();
    skipSetup.mockRejectedValueOnce("bad");
    resetSetup.mockRejectedValueOnce("bad");

    await store.getState().appSetup.skipSetup();
    expect(store.getState().appSetup.error).toBe("Unknown error");

    skipSetup.mockRejectedValueOnce(new Error("skip failed"));
    await store.getState().appSetup.skipSetup();
    expect(store.getState().appSetup.error).toBe("skip failed");

    await store.getState().appSetup.resetSetup();
    expect(store.getState().appSetup.error).toBe("Unknown error");

    resetSetup.mockRejectedValueOnce(new Error("reset failed"));
    await store.getState().appSetup.resetSetup();
    expect(store.getState().appSetup.error).toBe("reset failed");
  });

  it("sets local setup state and reads fallback selectors", () => {
    const { store } = createTestStore({ setupState: null });

    expect(store.getState().appSetup.isSetupComplete()).toBe(false);
    expect(store.getState().appSetup.getCurrentStep()).toBe(
      SETUP_STEPS.NOT_STARTED,
    );
    expect(store.getState().appSetup.getSelectedGames()).toEqual([]);

    const setupState = createSetupState(["poe2"], {
      currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
      isComplete: true,
    });
    store.getState().appSetup.setSetupState(setupState);
    store.getState().appSetup.setValidation({ isValid: true, errors: [] });
    store.getState().appSetup.setError("manual");

    expect(store.getState().appSetup.isSetupComplete()).toBe(true);
    expect(store.getState().appSetup.getCurrentStep()).toBe(
      SETUP_STEPS.TELEMETRY_CONSENT,
    );
    expect(store.getState().appSetup.getSelectedGames()).toEqual(["poe2"]);
    expect(store.getState().appSetup.validation).toEqual({
      errors: [],
      isValid: true,
    });
    expect(store.getState().appSetup.error).toBe("manual");
  });
});
