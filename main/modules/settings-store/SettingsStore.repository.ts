import type { DatabaseService } from "~/main/modules/database";

import {
  type AppSettings,
  AppSettingsSchema,
  createDefaultSettings,
} from "~/types";

class SettingsStoreRepository {
  constructor(private readonly database: DatabaseService) {}

  get(): AppSettings {
    const rows = this.database.queryAll(
      this.database.kysely.selectFrom("settings").select(["key", "value_json"]),
    );
    const values: Record<string, unknown> = {};

    for (const row of rows) {
      values[row.key] = JSON.parse(row.value_json);
    }

    return AppSettingsSchema.parse({
      ...createDefaultSettings(),
      ...values,
    });
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
