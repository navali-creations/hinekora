import type { DatabaseService } from "~/main/modules/database";
import { PoeLeaguesRepository } from "~/main/modules/poe-leagues/PoeLeagues.repository";

import {
  type AppSettings,
  AppSettingsSchema,
  createDefaultSettings,
  getLeagueSettingKey,
  normalizePersistedRecordingOutputResolution,
} from "~/types";

class SettingsStoreRepository {
  private readonly poeLeagues: PoeLeaguesRepository;

  constructor(private readonly database: DatabaseService) {
    this.poeLeagues = new PoeLeaguesRepository(database);
  }

  get(): AppSettings {
    const rows = this.database.queryAll(
      this.database.kysely.selectFrom("settings").select(["key", "value_json"]),
    );
    const values: Record<string, unknown> = {};

    for (const row of rows) {
      values[row.key] = JSON.parse(row.value_json);
    }
    if (Object.hasOwn(values, "recordingOutputResolution")) {
      values.recordingOutputResolution =
        normalizePersistedRecordingOutputResolution(
          values.recordingOutputResolution,
        );
    }
    if (
      !Object.hasOwn(values, "manualReplaySeconds") &&
      typeof values.deathClipSeconds === "number"
    ) {
      const legacyReplaySeconds = values.deathClipSeconds;
      values.manualReplaySeconds = legacyReplaySeconds;
      this.database.transaction(() => {
        this.upsertMany(
          { manualReplaySeconds: legacyReplaySeconds },
          new Date().toISOString(),
        );
      });
    }

    const defaults = createDefaultSettings();
    const poe1CurrentLeague =
      this.poeLeagues.getCurrent("poe1")?.name ?? defaults.poe1SelectedLeague;
    const poe2CurrentLeague =
      this.poeLeagues.getCurrent("poe2")?.name ?? defaults.poe2SelectedLeague;

    if (!Object.hasOwn(values, "poe1SelectedLeague")) {
      defaults.poe1SelectedLeague = poe1CurrentLeague;
    }
    if (!Object.hasOwn(values, "poe2SelectedLeague")) {
      defaults.poe2SelectedLeague = poe2CurrentLeague;
    }
    const activeGame = values.activeGame === "poe2" ? "poe2" : "poe1";
    const selectedLeague = values[getLeagueSettingKey(activeGame)];
    const currentLeague =
      activeGame === "poe2" ? poe2CurrentLeague : poe1CurrentLeague;

    // activeLeague remains in the public settings shape for backwards
    // compatibility, but the per-game selection is the source of truth.
    // Deriving it on every read also repairs legacy/stale persisted values.
    values.activeLeague =
      typeof selectedLeague === "string" ? selectedLeague : currentLeague;

    return AppSettingsSchema.parse({ ...defaults, ...values });
  }

  setMany(values: Partial<AppSettings>): AppSettings {
    const now = new Date().toISOString();

    this.database.transaction(() => {
      this.upsertMany(values, now);
    });

    return this.get();
  }

  replace(settings: AppSettings): AppSettings {
    this.database.transaction(() => {
      this.database.runQuery(this.database.kysely.deleteFrom("settings"));
      this.upsertMany(settings, new Date().toISOString());
    });

    return this.get();
  }

  private upsertMany(values: Partial<AppSettings>, now: string): void {
    for (const [key, value] of Object.entries(values)) {
      const valueJson = JSON.stringify(value);
      this.database.runQuery(
        this.database.kysely
          .insertInto("settings")
          .values({
            key,
            value_json: valueJson,
            updated_at: now,
          })
          .onConflict((conflict) =>
            conflict.column("key").doUpdateSet({
              value_json: valueJson,
              updated_at: now,
            }),
          ),
      );
    }
  }
}

export { SettingsStoreRepository };
