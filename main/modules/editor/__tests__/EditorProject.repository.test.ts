import { afterEach, describe, expect, it } from "vitest";

import { DatabaseService } from "~/main/modules/database";

import { createEditorProjectSummary } from "../EditorProject.mapper";
import { EditorProjectRepository } from "../EditorProject.repository";
import { createEditorProject } from "./Editor.test-factories";

let database: DatabaseService | null = null;

function createRepository(): EditorProjectRepository {
  database = new DatabaseService(":memory:");

  return new EditorProjectRepository(database);
}

function insertStoredProjectJson(id: string, projectJson: string): void {
  database?.db
    .prepare(
      `
      INSERT INTO editor_projects (
        id,
        title,
        duration_seconds,
        clip_count,
        project_json,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    )
    .run(
      id,
      id,
      0,
      0,
      projectJson,
      "2026-06-18T00:00:00.000Z",
      "2026-06-18T00:00:00.000Z",
    );
}

describe("EditorProjectRepository", () => {
  afterEach(() => {
    database?.close();
    database = null;
  });

  it("upserts, lists, loads, and deletes editor projects", () => {
    const repository = createRepository();
    const project = createEditorProject();
    const baseClip = project.tracks[0]?.clips[0];
    if (!baseClip) {
      throw new Error("Expected test project to include a clip");
    }
    const updatedProject = createEditorProject({
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      tracks: [
        {
          clips: [
            {
              ...baseClip,
              durationSeconds: 4,
              outSeconds: 4,
            },
          ],
          id: "video-track",
          kind: "video",
          label: "Video",
        },
      ],
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    const secondProject = createEditorProject({
      id: "project-2",
      title: "Older edit",
      updatedAt: "2026-06-18T00:30:00.000Z",
    });

    repository.upsert(project);
    repository.upsert(secondProject);
    repository.upsert(updatedProject);

    expect(repository.get(project.id)).toMatchObject({
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      tracks: [{ clips: [{ durationSeconds: 4, outSeconds: 4 }] }],
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    expect(createEditorProjectSummary(updatedProject)).toEqual({
      clipCount: 1,
      createdAt: "2026-06-18T00:00:00.000Z",
      durationSeconds: 4,
      id: project.id,
      title: "Trimmed edit",
      updatedAt: "2026-06-18T01:00:00.000Z",
    });
    expect(repository.list({ limit: 10 })).toEqual({
      hasMore: false,
      projects: [
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 4,
          id: project.id,
          title: "Trimmed edit",
          updatedAt: "2026-06-18T01:00:00.000Z",
        },
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 10,
          id: "project-2",
          title: "Older edit",
          updatedAt: "2026-06-18T00:30:00.000Z",
        },
      ],
    });
    expect(repository.list({ limit: 1 })).toEqual({
      hasMore: true,
      projects: [
        {
          clipCount: 1,
          createdAt: "2026-06-18T00:00:00.000Z",
          durationSeconds: 4,
          id: project.id,
          title: "Trimmed edit",
          updatedAt: "2026-06-18T01:00:00.000Z",
        },
      ],
    });

    repository.delete(project.id);

    expect(repository.get(project.id)).toBeNull();
    expect(repository.list({ limit: 10 }).projects).toHaveLength(1);

    repository.deleteAll();

    expect(repository.list({ limit: 10 }).projects).toEqual([]);
  });

  it("deletes saved projects past the newest limit while preserving a protected project", () => {
    const repository = createRepository();

    for (let index = 0; index < 7; index += 1) {
      repository.upsert(
        createEditorProject({
          id: `project-${index}`,
          title: `Saved edit ${index}`,
          updatedAt: `2026-06-18T00:0${index}:00.000Z`,
        }),
      );
    }

    expect(
      repository.deleteOlderThanLimit({
        limit: 5,
        protectedProjectId: "project-0",
      }),
    ).toBe(2);

    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual([
      "project-6",
      "project-5",
      "project-4",
      "project-3",
      "project-0",
    ]);
    expect(repository.get("project-2")).toBeNull();
    expect(repository.get("project-1")).toBeNull();
    expect(repository.get("project-0")).not.toBeNull();
  });

  it("prunes saved projects to the newest limit without a protected project", () => {
    const repository = createRepository();

    for (let index = 0; index < 30; index += 1) {
      repository.upsert(
        createEditorProject({
          id: `project-${index}`,
          title: `Saved edit ${index}`,
          updatedAt: `2026-06-18T00:${index.toString().padStart(2, "0")}:00.000Z`,
        }),
      );
    }

    expect(repository.deleteOlderThanLimit({ limit: 5 })).toBe(25);
    expect(
      repository.list({ limit: 10 }).projects.map((project) => project.id),
    ).toEqual([
      "project-29",
      "project-28",
      "project-27",
      "project-26",
      "project-25",
    ]);
    expect(repository.get("project-24")).toBeNull();
  });

  it("rejects corrupted stored project JSON", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "corrupt-project",
        "Corrupt",
        0,
        0,
        '{"id":"corrupt-project"}',
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("corrupt-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it("rejects non-object stored project JSON", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "null-project",
        "Null",
        0,
        0,
        "null",
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("null-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it("rejects stored project JSON with an invalid id", () => {
    const repository = createRepository();
    database?.db
      .prepare(
        `
        INSERT INTO editor_projects (
          id,
          title,
          duration_seconds,
          clip_count,
          project_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `,
      )
      .run(
        "invalid-id-project",
        "Invalid id",
        0,
        0,
        '{"id":1}',
        "2026-06-18T00:00:00.000Z",
        "2026-06-18T00:00:00.000Z",
      );

    expect(() => repository.get("invalid-id-project")).toThrow(
      "Editor project data is invalid",
    );
  });

  it.each([
    ["invalid-title-project", { id: "project-1", title: 1 }],
    [
      "invalid-created-project",
      { createdAt: 1, id: "project-1", title: "Project" },
    ],
    [
      "invalid-updated-project",
      {
        createdAt: "2026-06-18T00:00:00.000Z",
        id: "project-1",
        title: "Project",
        updatedAt: 1,
      },
    ],
    [
      "invalid-duration-project",
      {
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: "0",
        id: "project-1",
        title: "Project",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-assets-project",
      {
        assets: {},
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-tracks-project",
      {
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        tracks: {},
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-active-project",
      {
        activeClipId: 1,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        title: "Project",
        tracks: [],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-selected-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: 1,
        title: "Project",
        tracks: [],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-track-clips-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: null,
        title: "Project",
        tracks: [{ clips: {} }],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
    [
      "invalid-clip-id-project",
      {
        activeClipId: null,
        assets: [],
        createdAt: "2026-06-18T00:00:00.000Z",
        durationSeconds: 0,
        id: "project-1",
        selectedAssetKey: null,
        title: "Project",
        tracks: [{ clips: [{ id: 1 }] }],
        updatedAt: "2026-06-18T00:00:00.000Z",
      },
    ],
  ])("rejects stored project JSON shape %s", (id, projectJson) => {
    const repository = createRepository();
    insertStoredProjectJson(id, JSON.stringify(projectJson));

    expect(() => repository.get(id)).toThrow("Editor project data is invalid");
  });
});
