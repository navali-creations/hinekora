import { describe, expect, it } from "vitest";

import { createDefaultSettings } from "~/types";
import { DatabaseService } from "../../database";
import { SettingsStoreRepository } from "../SettingsStore.repository";

describe("SettingsStoreRepository", () => {
  it("persists partial updates and replaces all settings", () => {
    const database = new DatabaseService(":memory:");
    const repository = new SettingsStoreRepository(database);

    expect(repository.get()).toMatchObject({
      activeGame: "poe1",
      deathClipSeconds: 10,
      onboardingDismissedBeacons: [],
    });

    repository.setMany({
      activeGame: "poe2",
      activeLeague: "Mercenaries",
      deathClipSeconds: 15,
      onboardingDismissedBeacons: ["game-selector"],
    });

    expect(repository.get()).toMatchObject({
      activeGame: "poe2",
      activeLeague: "Mercenaries",
      deathClipSeconds: 15,
      onboardingDismissedBeacons: ["game-selector"],
    });

    repository.replace({
      ...createDefaultSettings(),
      activeGame: "poe1",
      activeLeague: "Hardcore",
      deathClipSeconds: 8,
    });

    expect(repository.get()).toMatchObject({
      activeGame: "poe1",
      activeLeague: "Hardcore",
      deathClipSeconds: 8,
    });

    database.close();
  });
});
