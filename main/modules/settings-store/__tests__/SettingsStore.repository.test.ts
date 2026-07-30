import { describe, expect, it } from "vitest";

import { createDefaultSettings, getCurrentLeague } from "~/types";
import { DatabaseService } from "../../database";
import { PoeLeaguesRepository } from "../../poe-leagues/PoeLeagues.repository";
import { SettingsStoreRepository } from "../SettingsStore.repository";

describe("SettingsStoreRepository", () => {
  it("persists partial updates and replaces all settings", () => {
    const database = new DatabaseService(":memory:");
    const repository = new SettingsStoreRepository(database);

    expect(repository.get()).toMatchObject({
      activeGame: "poe1",
      activeLeague: getCurrentLeague("poe1"),
      auraOverlayShowEditingFrame: true,
      deathClipsEnabled: true,
      deathClipSeconds: 10,
      manualReplaySeconds: 10,
      groupPlayDeathAlertDismissed: false,
      onboardingDismissedBeacons: [],
      poe1CharacterName: "",
      recorderOverlayShowOnStartup: true,
      recorderOverlayStartMinimized: false,
      recorderSettingsInfoAlertDismissed: false,
    });

    repository.setMany({
      activeGame: "poe2",
      activeLeague: "Mercenaries",
      auraOverlayShowEditingFrame: false,
      deathClipSeconds: 15,
      groupPlayDeathAlertDismissed: true,
      onboardingDismissedBeacons: ["game-selector"],
      poe1CharacterName: "Ailucannon",
      poe2SelectedLeague: "Mercenaries",
      poe2CharacterName: "Ailumonk",
      recorderOverlayShowOnStartup: false,
      recorderOverlayStartMinimized: true,
      recorderSettingsInfoAlertDismissed: true,
    });

    expect(repository.get()).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Mercenaries",
      auraOverlayShowEditingFrame: false,
      deathClipSeconds: 15,
      groupPlayDeathAlertDismissed: true,
      onboardingDismissedBeacons: ["game-selector"],
      poe1CharacterName: "Ailucannon",
      poe2CharacterName: "Ailumonk",
      recorderOverlayShowOnStartup: false,
      recorderOverlayStartMinimized: true,
      recorderSettingsInfoAlertDismissed: true,
    });

    repository.replace({
      ...createDefaultSettings(),
      activeGame: "poe1",
      activeLeague: "Hardcore",
      deathClipSeconds: 8,
      poe1SelectedLeague: "Hardcore",
    });

    expect(repository.get()).toMatchObject({
      activeGame: "poe1",
      activeLeague: "Hardcore",
      deathClipSeconds: 8,
    });

    database.close();
  });

  it("migrates a missing manual replay timer from the stored death timer", () => {
    const database = new DatabaseService(":memory:");
    database.db
      .prepare("DELETE FROM settings WHERE key = ?")
      .run("manualReplaySeconds");
    database.db
      .prepare(
        "UPDATE settings SET value_json = ?, updated_at = ? WHERE key = ?",
      )
      .run(JSON.stringify(37), "2026-07-29T00:00:00.000Z", "deathClipSeconds");
    const repository = new SettingsStoreRepository(database);

    expect(repository.get()).toMatchObject({
      deathClipsEnabled: true,
      deathClipSeconds: 37,
      manualReplaySeconds: 37,
    });
    expect(
      database.db
        .prepare("SELECT value_json FROM settings WHERE key = ?")
        .get("manualReplaySeconds"),
    ).toEqual({ value_json: "37" });

    expect(repository.setMany({ deathClipSeconds: 55 })).toMatchObject({
      deathClipSeconds: 55,
      manualReplaySeconds: 37,
    });

    database.close();
  });

  it("preserves explicitly stored league preferences", () => {
    const database = new DatabaseService(":memory:");
    const repository = new SettingsStoreRepository(database);

    expect(repository.get()).toMatchObject({
      activeLeague: getCurrentLeague("poe1"),
      editorAutoPruneProjects: true,
      poe1SelectedLeague: getCurrentLeague("poe1"),
      poe2SelectedLeague: getCurrentLeague("poe2"),
    });

    repository.replace({
      ...createDefaultSettings(),
      activeLeague: "Standard",
      poe1SelectedLeague: "Standard",
      poe2SelectedLeague: "Standard",
      setupCompleted: true,
    });

    expect(repository.get()).toMatchObject({
      activeLeague: "Standard",
      poe1SelectedLeague: "Standard",
      poe2SelectedLeague: "Standard",
    });

    database.close();
  });

  it("resolves missing league defaults from the current SQLite catalog", () => {
    const database = new DatabaseService(":memory:");
    const leagues = new PoeLeaguesRepository(database);
    const repository = new SettingsStoreRepository(database);
    leagues.replaceActive(
      "poe1",
      [
        {
          endAt: null,
          id: "Next League",
          isCurrent: true,
          name: "Next League",
          startAt: null,
          updatedAt: null,
        },
        {
          endAt: null,
          id: "Standard",
          isCurrent: false,
          name: "Standard",
          startAt: null,
          updatedAt: null,
        },
      ],
      "test-provider",
      "2026-08-01T00:00:00.000Z",
    );
    leagues.replaceActive(
      "poe2",
      [
        {
          endAt: null,
          id: "Runes of Aldur",
          isCurrent: true,
          name: "Runes of Aldur",
          startAt: null,
          updatedAt: null,
        },
        {
          endAt: null,
          id: "Standard",
          isCurrent: false,
          name: "Standard",
          startAt: null,
          updatedAt: null,
        },
      ],
      "test-provider",
      "2026-08-01T00:00:00.000Z",
    );

    expect(repository.get()).toMatchObject({
      activeLeague: "Next League",
      poe1SelectedLeague: "Next League",
      poe2SelectedLeague: "Runes of Aldur",
    });

    repository.setMany({ activeGame: "poe2" });
    expect(repository.get()).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Runes of Aldur",
    });

    repository.setMany({ poe2SelectedLeague: "Standard" });
    expect(repository.get()).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Standard",
      poe2SelectedLeague: "Standard",
    });

    database.close();
  });

  it("falls back to schema league defaults when the catalog has no current rows", () => {
    const database = new DatabaseService(":memory:");
    database.db.prepare("UPDATE poe_leagues SET is_current = 0").run();
    const repository = new SettingsStoreRepository(database);

    expect(repository.get()).toMatchObject({
      activeLeague: getCurrentLeague("poe1"),
      poe1SelectedLeague: getCurrentLeague("poe1"),
      poe2SelectedLeague: getCurrentLeague("poe2"),
    });

    database.close();
  });

  it("falls back to native for an unsupported persisted recording resolution", () => {
    const database = new DatabaseService(":memory:");
    const repository = new SettingsStoreRepository(database);
    database.db
      .prepare(
        "UPDATE settings SET value_json = ?, updated_at = ? WHERE key = ?",
      )
      .run(
        JSON.stringify("854x480"),
        "2026-07-17T00:00:00.000Z",
        "recordingOutputResolution",
      );

    expect(repository.get().recordingOutputResolution).toBe("native");

    database.db
      .prepare("DELETE FROM settings WHERE key = ?")
      .run("recordingOutputResolution");
    expect(repository.get().recordingOutputResolution).toBe("native");

    database.close();
  });
});
