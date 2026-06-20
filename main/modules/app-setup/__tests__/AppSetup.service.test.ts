import fs, { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DatabaseService } from "~/main/modules/database";
import { SettingsStoreService } from "~/main/modules/settings-store";
import { mockIpcMainHandlers } from "~/main/test/ipc";

import { createDefaultSettings } from "~/types";
import { AppSetupChannel } from "../AppSetup.channels";
import { AppSetupService } from "../AppSetup.service";
import { SETUP_STEPS } from "../AppSetup.types";

describe("AppSetupService", () => {
  let database: DatabaseService;
  let settingsStore: SettingsStoreService;
  let service: AppSetupService;
  let tempDir: string;
  let clientTxtPath: string;

  beforeEach(() => {
    database = DatabaseService.getInstance(":memory:");
    settingsStore = new SettingsStoreService();
    service = new AppSetupService(settingsStore);
    tempDir = mkdtempSync(join(tmpdir(), "hinekora-app-setup-"));
    clientTxtPath = join(tempDir, "Client.txt");
    writeFileSync(clientTxtPath, "client log", "utf8");
  });

  afterEach(() => {
    AppSetupService.resetForTests();
    SettingsStoreService.resetForTests();
    DatabaseService.resetForTests();
    rmSync(tempDir, { recursive: true, force: true });
  });

  it("returns setup state from settings defaults", () => {
    expect(service.getSetupState()).toEqual({
      currentStep: SETUP_STEPS.NOT_STARTED,
      isComplete: false,
      selectedGames: ["poe1"],
      poe1ClientPath: null,
      poe2ClientPath: null,
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
    });
    expect(service.isSetupComplete()).toBe(false);
  });

  it("creates and resets the singleton instance", () => {
    AppSetupService.resetForTests();
    SettingsStoreService.resetForTests();

    const first = AppSetupService.getInstance();
    const second = AppSetupService.getInstance();

    expect(second).toBe(first);

    AppSetupService.resetForTests();
    const replacement = AppSetupService.getInstance();

    expect(replacement).not.toBe(first);
  });

  it("advances through setup and defaults telemetry when entering consent", () => {
    expect(service.advanceStep()).toEqual({ success: true });
    expect(service.getSetupState().currentStep).toBe(SETUP_STEPS.SELECT_GAME);

    expect(service.advanceStep()).toEqual({ success: true });
    expect(service.getSetupState().currentStep).toBe(
      SETUP_STEPS.SELECT_CLIENT_PATH,
    );

    expect(service.advanceStep()).toEqual({
      success: false,
      error: "Please select Path of Exile 1 Client.txt path",
    });

    settingsStore.update({ poe1ClientTxtPath: clientTxtPath });

    expect(service.advanceStep()).toEqual({ success: true });
    expect(service.getSetupState()).toMatchObject({
      currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
    });
  });

  it("validates selected Client.txt paths for each selected game", () => {
    settingsStore.update({
      installedGames: ["poe1", "poe2"],
      setupStep: SETUP_STEPS.SELECT_CLIENT_PATH,
      poe1ClientTxtPath: clientTxtPath,
    });

    expect(service.validateCurrentStep()).toEqual({
      isValid: false,
      errors: ["Please select Path of Exile 2 Client.txt path"],
    });

    settingsStore.update({
      poe2ClientTxtPath: join(tempDir, "NotClient.log"),
    });
    writeFileSync(join(tempDir, "NotClient.log"), "client log", "utf8");

    expect(service.validateCurrentStep()).toEqual({
      isValid: false,
      errors: [
        "Path of Exile 2 Client.txt path is invalid or file does not exist",
      ],
    });

    settingsStore.update({ poe2ClientTxtPath: join(tempDir, "Missing.txt") });

    expect(service.validateCurrentStep()).toEqual({
      isValid: false,
      errors: [
        "Path of Exile 2 Client.txt path is invalid or file does not exist",
      ],
    });

    const poe2ClientTxtPath = join(tempDir, "poe2", "Client.txt");
    mkdirSync(join(tempDir, "poe2"));
    writeFileSync(poe2ClientTxtPath, "client log", "utf8");
    settingsStore.update({ poe2ClientTxtPath });

    expect(service.validateCurrentStep()).toEqual({
      isValid: true,
      errors: [],
    });
  });

  it("guards against an empty selected game list", () => {
    const emptyGamesSettingsStore = {
      get: vi.fn(() => ({
        ...createDefaultSettings(),
        installedGames: [],
        setupStep: SETUP_STEPS.SELECT_GAME,
      })),
      update: vi.fn(),
    } as unknown as SettingsStoreService;
    const emptyGamesService = new AppSetupService(emptyGamesSettingsStore);

    expect(emptyGamesService.validateCurrentStep()).toEqual({
      isValid: false,
      errors: ["Please select at least one game"],
    });
  });

  it("rejects directories and filesystem errors as invalid client paths", () => {
    const directoryPath = join(tempDir, "directory", "Client.txt");
    mkdirSync(directoryPath, { recursive: true });
    settingsStore.update({
      setupStep: SETUP_STEPS.SELECT_CLIENT_PATH,
      poe1ClientTxtPath: directoryPath,
    });

    expect(service.validateCurrentStep()).toEqual({
      isValid: false,
      errors: [
        "Path of Exile 1 Client.txt path is invalid or file does not exist",
      ],
    });

    const existsSpy = vi.spyOn(fs, "existsSync").mockReturnValue(true);
    const statSpy = vi.spyOn(fs, "statSync").mockImplementation(() => {
      throw new Error("stat failed");
    });

    expect(service.validateCurrentStep()).toEqual({
      isValid: false,
      errors: [
        "Path of Exile 1 Client.txt path is invalid or file does not exist",
      ],
    });

    existsSpy.mockRestore();
    statSpy.mockRestore();
  });

  it("completes setup and selects the first installed game", () => {
    settingsStore.update({
      installedGames: ["poe2"],
      poe2ClientTxtPath: clientTxtPath,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });

    expect(service.completeSetup()).toEqual({ success: true });
    expect(service.getSetupState()).toMatchObject({
      isComplete: true,
      selectedGames: ["poe2"],
    });
    expect(settingsStore.get()).toMatchObject({
      activeGame: "poe2",
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });
  });

  it("normalizes selected games and falls back to poe1 when setup is skipped without games", () => {
    const updateSettings = vi.fn();
    const duplicateGamesService = new AppSetupService({
      get: vi.fn(() => ({
        ...createDefaultSettings(),
        installedGames: ["poe2", "poe1", "poe2"],
        poe1ClientTxtPath: clientTxtPath,
        poe2ClientTxtPath: clientTxtPath,
        setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
      })),
      update: updateSettings,
    } as unknown as SettingsStoreService);

    expect(duplicateGamesService.getSetupState().selectedGames).toEqual([
      "poe1",
      "poe2",
    ]);
    expect(duplicateGamesService.completeSetup()).toEqual({ success: true });
    expect(updateSettings).toHaveBeenCalledWith({
      activeGame: "poe1",
      installedGames: ["poe1", "poe2"],
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });

    const skipUpdateSettings = vi.fn();
    const emptyGamesService = new AppSetupService({
      get: vi.fn(() => ({
        ...createDefaultSettings(),
        installedGames: [],
        activeGame: "poe2",
      })),
      update: skipUpdateSettings,
    } as unknown as SettingsStoreService);

    emptyGamesService.skipSetup();

    expect(skipUpdateSettings).toHaveBeenCalledWith({
      activeGame: "poe1",
      installedGames: [],
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
    });
  });

  it("refuses to complete when required setup data is missing", () => {
    expect(service.completeSetup()).toEqual({
      success: false,
      error: "Setup incomplete: Please select Path of Exile 1 Client.txt path",
    });
  });

  it("allows going backward or one step ahead but not skipping ahead", () => {
    settingsStore.update({ setupStep: SETUP_STEPS.SELECT_GAME });

    expect(service.goToStep(SETUP_STEPS.TELEMETRY_CONSENT)).toEqual({
      success: false,
      error: "Cannot skip ahead in setup",
    });

    expect(service.goToStep(SETUP_STEPS.SELECT_CLIENT_PATH)).toEqual({
      success: true,
    });
    expect(service.goToStep(SETUP_STEPS.SELECT_GAME)).toEqual({
      success: true,
    });
  });

  it("resets and skips setup", () => {
    settingsStore.update({
      setupCompleted: true,
      setupStep: SETUP_STEPS.TELEMETRY_CONSENT,
      telemetryCrashReporting: false,
      telemetryUsageAnalytics: false,
    });

    service.resetSetup();
    expect(service.getSetupState()).toMatchObject({
      currentStep: SETUP_STEPS.NOT_STARTED,
      isComplete: false,
    });

    service.skipSetup();
    expect(service.getSetupState()).toMatchObject({
      currentStep: SETUP_STEPS.TELEMETRY_CONSENT,
      isComplete: true,
      telemetryCrashReporting: true,
      telemetryUsageAnalytics: true,
    });
  });

  it("registers guarded IPC handlers with setup step validation", async () => {
    const { handlers } = mockIpcMainHandlers();
    database.close();
    DatabaseService.resetForTests();
    DatabaseService.getInstance(":memory:");
    const ipcSettingsStore = new SettingsStoreService();
    ipcSettingsStore.update({ poe1ClientTxtPath: clientTxtPath });
    new AppSetupService(ipcSettingsStore);

    expect(
      await handlers.get(AppSetupChannel.GetSetupState)?.({}),
    ).toMatchObject({
      currentStep: SETUP_STEPS.NOT_STARTED,
    });
    expect(
      await handlers.get(AppSetupChannel.GoToStep)?.(
        {},
        SETUP_STEPS.SELECT_GAME,
      ),
    ).toEqual({ success: true });
    expect(await handlers.get(AppSetupChannel.GoToStep)?.({}, 99)).toEqual({
      ok: false,
      error: "setup step is invalid",
    });
    expect(await handlers.get(AppSetupChannel.IsSetupComplete)?.({})).toBe(
      false,
    );
    expect(
      await handlers.get(AppSetupChannel.ValidateCurrentStep)?.({}),
    ).toEqual({
      isValid: true,
      errors: [],
    });
    expect(
      await handlers.get(AppSetupChannel.ResetSetup)?.({}),
    ).toBeUndefined();
    expect(await handlers.get(AppSetupChannel.SkipSetup)?.({})).toBeUndefined();
    expect(
      await handlers.get(AppSetupChannel.CompleteSetup)?.({}),
    ).toMatchObject({
      success: true,
    });
    expect(await handlers.get(AppSetupChannel.AdvanceStep)?.({})).toMatchObject(
      {
        success: true,
      },
    );
  });
});
