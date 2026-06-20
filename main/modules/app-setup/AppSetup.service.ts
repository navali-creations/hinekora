import fs from "node:fs";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { SettingsStoreService } from "~/main/modules/settings-store";
import {
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import type { AppSetupStep, GameId } from "~/types";
import { AppSetupChannel } from "./AppSetup.channels";
import {
  type AppSetupResult,
  SETUP_STEPS,
  type SetupState,
  type StepValidationResult,
} from "./AppSetup.types";

class AppSetupService {
  private static instance: AppSetupService | null = null;

  private readonly settingsStore: SettingsStoreService;

  static getInstance(): AppSetupService {
    if (!AppSetupService.instance) {
      AppSetupService.instance = new AppSetupService();
    }

    return AppSetupService.instance;
  }

  static resetForTests(): void {
    AppSetupService.instance = null;
  }

  constructor(settingsStore = SettingsStoreService.getInstance()) {
    this.settingsStore = settingsStore;
    this.setupHandlers();
  }

  getSetupState(): SetupState {
    const settings = this.settingsStore.get();

    return {
      currentStep: settings.setupStep,
      isComplete: settings.setupCompleted,
      selectedGames: this.normalizeSelectedGames(settings.installedGames),
      poe1ClientPath: settings.poe1ClientTxtPath,
      poe2ClientPath: settings.poe2ClientTxtPath,
      telemetryCrashReporting: settings.telemetryCrashReporting,
      telemetryUsageAnalytics: settings.telemetryUsageAnalytics,
    };
  }

  isSetupComplete(): boolean {
    return this.settingsStore.get().setupCompleted;
  }

  validateCurrentStep(): StepValidationResult {
    const currentStep = this.settingsStore.get().setupStep;

    switch (currentStep) {
      case SETUP_STEPS.SELECT_GAME:
        return this.validateGameSelection();
      case SETUP_STEPS.SELECT_CLIENT_PATH:
        return this.validateClientPaths();
      case SETUP_STEPS.TELEMETRY_CONSENT:
      case SETUP_STEPS.NOT_STARTED:
        return { isValid: true, errors: [] };
    }
  }

  advanceStep(): AppSetupResult {
    const validation = this.validateCurrentStep();
    if (!validation.isValid) {
      return {
        success: false,
        error: validation.errors.join(", "),
      };
    }

    const currentStep = this.settingsStore.get().setupStep;
    const nextStep = (currentStep + 1) as AppSetupStep;

    if (nextStep > SETUP_STEPS.TELEMETRY_CONSENT) {
      return this.completeSetup();
    }

    if (nextStep === SETUP_STEPS.TELEMETRY_CONSENT) {
      this.settingsStore.update({
        telemetryCrashReporting: true,
        telemetryUsageAnalytics: true,
      });
    }

    this.settingsStore.update({ setupStep: nextStep });

    return { success: true };
  }

  goToStep(step: AppSetupStep): AppSetupResult {
    const currentStep = this.settingsStore.get().setupStep;

    if (step > currentStep + 1) {
      return {
        success: false,
        error: "Cannot skip ahead in setup",
      };
    }

    this.settingsStore.update({ setupStep: step });

    return { success: true };
  }

  completeSetup(): AppSetupResult {
    const gameValidation = this.validateGameSelection();
    const pathValidation = this.validateClientPaths();
    const errors = [...gameValidation.errors, ...pathValidation.errors];

    if (errors.length > 0) {
      return {
        success: false,
        error: `Setup incomplete: ${errors.join(", ")}`,
      };
    }

    const selectedGames = this.normalizeSelectedGames(
      this.settingsStore.get().installedGames,
    );

    this.settingsStore.update({
      activeGame: this.getPrimaryGame(selectedGames),
      installedGames: selectedGames,
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });

    return { success: true };
  }

  resetSetup(): void {
    this.settingsStore.update({
      setupCompleted: false,
      setupStep: SETUP_STEPS.NOT_STARTED,
    });
  }

  skipSetup(): void {
    const selectedGames = this.normalizeSelectedGames(
      this.settingsStore.get().installedGames,
    );

    this.settingsStore.update({
      activeGame: this.getPrimaryGame(selectedGames),
      installedGames: selectedGames,
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      AppSetupChannel.GetSetupState,
      [WindowName.Main],
      () => this.getSetupState(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.IsSetupComplete,
      [WindowName.Main],
      () => this.isSetupComplete(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.AdvanceStep,
      [WindowName.Main],
      () => this.advanceStep(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.GoToStep,
      [WindowName.Main],
      (_event, step: unknown) => {
        try {
          this.assertSetupStep(step, AppSetupChannel.GoToStep);
          return this.goToStep(step);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      AppSetupChannel.ValidateCurrentStep,
      [WindowName.Main],
      () => this.validateCurrentStep(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.CompleteSetup,
      [WindowName.Main],
      () => this.completeSetup(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.ResetSetup,
      [WindowName.Main],
      () => this.resetSetup(),
    );
    registerGuardedIpcHandler(
      AppSetupChannel.SkipSetup,
      [WindowName.Main],
      () => this.skipSetup(),
    );
  }

  private validateGameSelection(): StepValidationResult {
    const selectedGames = this.normalizeSelectedGames(
      this.settingsStore.get().installedGames,
    );
    const errors: string[] = [];

    if (selectedGames.length === 0) {
      errors.push("Please select at least one game");
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private validateClientPaths(): StepValidationResult {
    const settings = this.settingsStore.get();
    const selectedGames = this.normalizeSelectedGames(settings.installedGames);
    const errors: string[] = [];

    if (selectedGames.includes("poe1")) {
      if (!settings.poe1ClientTxtPath) {
        errors.push("Please select Path of Exile 1 Client.txt path");
      } else if (!this.isValidClientPath(settings.poe1ClientTxtPath)) {
        errors.push(
          "Path of Exile 1 Client.txt path is invalid or file does not exist",
        );
      }
    }

    if (selectedGames.includes("poe2")) {
      if (!settings.poe2ClientTxtPath) {
        errors.push("Please select Path of Exile 2 Client.txt path");
      } else if (!this.isValidClientPath(settings.poe2ClientTxtPath)) {
        errors.push(
          "Path of Exile 2 Client.txt path is invalid or file does not exist",
        );
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  private isValidClientPath(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath)) {
        return false;
      }

      const stats = fs.statSync(filePath);
      if (!stats.isFile()) {
        return false;
      }

      const separatorIndex = Math.max(
        filePath.lastIndexOf("/"),
        filePath.lastIndexOf("\\"),
      );
      const fileName = filePath.slice(separatorIndex + 1);

      return fileName.toLowerCase() === "client.txt";
    } catch {
      return false;
    }
  }

  private normalizeSelectedGames(games: GameId[]): GameId[] {
    const selectedGames = games.filter(
      (game, index) => games.indexOf(game) === index,
    );

    return selectedGames.sort((left, right) => left.localeCompare(right));
  }

  private getPrimaryGame(games: GameId[]): GameId {
    return games[0] ?? "poe1";
  }

  private assertSetupStep(
    value: unknown,
    channel: AppSetupChannel,
  ): asserts value is AppSetupStep {
    if (
      value !== SETUP_STEPS.NOT_STARTED &&
      value !== SETUP_STEPS.SELECT_GAME &&
      value !== SETUP_STEPS.SELECT_CLIENT_PATH &&
      value !== SETUP_STEPS.TELEMETRY_CONSENT
    ) {
      throw new IpcValidationError(channel, "setup step is invalid");
    }
  }
}

export { AppSetupService };
