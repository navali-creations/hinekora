import { describe, expect, it } from "vitest";

import { createDefaultProfile } from "~/types";
import { DatabaseService } from "../../database";
import { mapProfileRow } from "../Profiles.mapper";
import { ProfilesRepository } from "../Profiles.repository";

describe("ProfilesRepository", () => {
  it("maps profile rows with non-object JSON data", () => {
    expect(() =>
      mapProfileRow({
        id: "profile-1",
        name: "Imported",
        game: "poe1",
        data_json: "null",
        created_at: "2026-06-12T10:00:00.000Z",
        updated_at: "2026-06-12T10:00:00.000Z",
      }),
    ).toThrow();
  });

  it("creates, updates, lists, deletes, and replaces profiles", () => {
    const database = new DatabaseService(":memory:");
    const repository = new ProfilesRepository(database);

    const created = repository.create({
      name: "Mapper",
      game: "poe1",
    });

    expect(repository.list()).toEqual([created]);

    const updated = repository.update({
      id: created.id,
      name: "Boss Mapper",
      targetFps: 60,
    });

    expect(updated).toMatchObject({
      id: created.id,
      name: "Boss Mapper",
      targetFps: 60,
    });

    expect(
      repository.update({
        id: created.id,
        captureTarget: null,
      }),
    ).toMatchObject({
      id: created.id,
      captureTarget: null,
    });

    expect(() =>
      repository.update({
        id: "missing-profile",
        name: "Missing",
      }),
    ).toThrow("Profile not found");

    repository.delete(created.id);
    expect(repository.list()).toEqual([]);

    const replacement = createDefaultProfile({
      name: "Replacement",
      game: "poe2",
    });
    repository.replaceAll([replacement]);

    expect(repository.list()).toEqual([replacement]);

    database.close();
  });
});
