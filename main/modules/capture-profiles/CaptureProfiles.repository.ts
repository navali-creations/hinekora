import type { DatabaseService } from "~/main/modules/database";

import {
  type CaptureProfile,
  type CaptureProfileCreateInput,
  type CaptureProfileUpdateInput,
  CaptureProfileUpdateInputSchema,
  captureProfileSettingKeys,
  createDefaultCaptureProfile,
} from "~/types";
import { mapCaptureProfileRow } from "./CaptureProfiles.mapper";

class CaptureProfilesRepository {
  constructor(private readonly database: DatabaseService) {}

  list(): CaptureProfile[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("capture_profiles")
        .selectAll()
        .orderBy("updated_at", "desc"),
    );

    return rows.map(mapCaptureProfileRow);
  }

  get(id: string): CaptureProfile | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("capture_profiles")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapCaptureProfileRow(row) : null;
  }

  create(input: CaptureProfileCreateInput): CaptureProfile {
    const profile = createDefaultCaptureProfile(input);
    this.upsert(profile);

    return profile;
  }

  update(input: CaptureProfileUpdateInput): CaptureProfile {
    const parsed = CaptureProfileUpdateInputSchema.parse(input);
    const existing = this.get(parsed.id);

    if (!existing) {
      throw new Error("Capture profile not found");
    }

    const updated: CaptureProfile = {
      ...existing,
      name: parsed.name ?? existing.name,
      game: parsed.game ?? existing.game,
      captureTarget:
        parsed.captureTarget === undefined
          ? existing.captureTarget
          : parsed.captureTarget,
      updatedAt: new Date().toISOString(),
    };
    for (const key of captureProfileSettingKeys) {
      if (parsed[key] !== undefined) {
        updated[key] = parsed[key] as never;
      }
    }

    this.upsert(updated);

    return updated;
  }

  upsert(profile: CaptureProfile): void {
    const dataJson = JSON.stringify(profile);

    this.database.runQuery(
      this.database.kysely
        .insertInto("capture_profiles")
        .values({
          id: profile.id,
          name: profile.name,
          game: profile.game,
          data_json: dataJson,
          created_at: profile.createdAt,
          updated_at: profile.updatedAt,
        })
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            name: profile.name,
            game: profile.game,
            data_json: dataJson,
            updated_at: profile.updatedAt,
          }),
        ),
    );
  }

  delete(id: string): void {
    this.database.runQuery(
      this.database.kysely.deleteFrom("capture_profiles").where("id", "=", id),
    );
  }

  replaceAll(profiles: CaptureProfile[]): void {
    this.database.transaction(() => {
      this.database.runQuery(
        this.database.kysely.deleteFrom("capture_profiles"),
      );
      for (const profile of profiles) {
        this.upsert(profile);
      }
    });
  }
}

export { CaptureProfilesRepository };
