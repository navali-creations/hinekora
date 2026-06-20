import type { DatabaseService } from "~/main/modules/database";

import type { EditorProject, EditorProjectSummary } from "./Editor.dto";
import {
  countEditorProjectClips,
  mapEditorProjectRow,
  mapEditorProjectSummaryRow,
} from "./EditorProject.mapper";

interface EditorProjectListResult {
  hasMore: boolean;
  projects: EditorProjectSummary[];
}

class EditorProjectRepository {
  constructor(private readonly database: DatabaseService) {}

  list(input: { limit: number }): EditorProjectListResult {
    const queryLimit = input.limit + 1;
    const rows = this.database.queryAll(
      this.database.kysely
        .selectFrom("editor_projects")
        .select([
          "id",
          "title",
          "duration_seconds",
          "clip_count",
          "created_at",
          "updated_at",
        ])
        .orderBy("updated_at", "desc")
        .limit(queryLimit),
    );
    const projects = rows.slice(0, input.limit).map(mapEditorProjectSummaryRow);

    return {
      hasMore: rows.length > input.limit,
      projects,
    };
  }

  get(id: string): EditorProject | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("editor_projects")
        .selectAll()
        .where("id", "=", id),
    );

    return row ? mapEditorProjectRow(row) : null;
  }

  upsert(project: EditorProject): void {
    const projectJson = JSON.stringify(project);
    const clipCount = countEditorProjectClips(project);

    this.database.runQuery(
      this.database.kysely
        .insertInto("editor_projects")
        .values({
          clip_count: clipCount,
          created_at: project.createdAt,
          duration_seconds: project.durationSeconds,
          id: project.id,
          project_json: projectJson,
          title: project.title,
          updated_at: project.updatedAt,
        })
        .onConflict((conflict) =>
          conflict.column("id").doUpdateSet({
            clip_count: clipCount,
            duration_seconds: project.durationSeconds,
            project_json: projectJson,
            title: project.title,
            updated_at: project.updatedAt,
          }),
        ),
    );
  }

  delete(id: string): void {
    this.database.runQuery(
      this.database.kysely.deleteFrom("editor_projects").where("id", "=", id),
    );
  }
}

export type { EditorProjectListResult };
export { EditorProjectRepository };
