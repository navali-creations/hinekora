import type { DatabaseService } from "~/main/modules/database";

import {
  createDefaultProfile,
  type Profile,
  type ProfileCreateInput,
  type ProfileUpdateInput,
  ProfileUpdateInputSchema,
} from "~/types";
import { mapProfileRow } from "./Profiles.mapper";

class ProfilesRepository {
  constructor(private readonly database: DatabaseService) {}

  list(): Profile[] {
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("profiles")
        .selectAll()
        .orderBy("updated_at", "desc"),
    );

    return rows.map(mapProfileRow);
  }

  create(input: ProfileCreateInput): Profile {
    const profile = createDefaultProfile(input);
    this.upsert(profile);

    return profile;
  }

  update(input: ProfileUpdateInput): Profile {
    const parsed = ProfileUpdateInputSchema.parse(input);
    const existing = this.get(parsed.id);

    if (!existing) {
      throw new Error("Profile not found");
    }

    const updated: Profile = {
      ...existing,
      name: parsed.name ?? existing.name,
      targetFps: parsed.targetFps ?? existing.targetFps,
      captureTarget:
        parsed.captureTarget === undefined
          ? existing.captureTarget
          : parsed.captureTarget,
      cropRegions: parsed.cropRegions ?? existing.cropRegions,
      overlayPlacements: parsed.overlayPlacements ?? existing.overlayPlacements,
      updatedAt: new Date().toISOString(),
    };

    this.upsert(updated);

    return updated;
  }

  upsert(profile: Profile): void {
    const dataJson = JSON.stringify(profile);

    this.database.runQuery(
      this.database.kysely
        .insertInto("profiles")
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
      this.database.kysely.deleteFrom("profiles").where("id", "=", id),
    );
  }

  replaceAll(profiles: Profile[]): void {
    this.database.transaction(() => {
      this.database.runQuery(this.database.kysely.deleteFrom("profiles"));
      for (const profile of profiles) {
        this.upsert(profile);
      }
    });
  }

  private get(id: string): Profile | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("profiles")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapProfileRow(row) : null;
  }
}

export { ProfilesRepository };
