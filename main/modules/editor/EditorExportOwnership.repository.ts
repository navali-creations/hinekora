import { sql } from "kysely";

import type { DatabaseService } from "~/main/modules/database";

const editorExportOwnershipMigrationId = "20260723_000000_editor_export_videos";

interface EditorExportOwnershipRecord {
  deviceId: number;
  inode: number;
  modifiedAtMs: number;
  path: string;
  sizeBytes: number;
}

interface EditorExportOwnershipRow {
  device_id: string;
  inode: string;
  modified_at_ms: number;
  path: string;
  size_bytes: number;
}

class EditorExportOwnershipRepository {
  constructor(private readonly database: DatabaseService) {}

  getTrackingStartedAtMs(): number | null {
    const row = this.database.queryOne(
      this.database.kysely
        .selectFrom("migrations")
        .select("applied_at")
        .where("id", "=", editorExportOwnershipMigrationId),
    );

    return row ? Date.parse(row.applied_at) : null;
  }

  list(): EditorExportOwnershipRecord[] {
    return this.database
      .queryAll<EditorExportOwnershipRow>(
        this.database.kysely
          .selectFrom("editor_export_videos")
          .select([
            sql<string>`CAST(device_id AS TEXT)`.as("device_id"),
            sql<string>`CAST(inode AS TEXT)`.as("inode"),
            "modified_at_ms",
            "path",
            "size_bytes",
          ]),
      )
      .map(mapEditorExportOwnershipRow);
  }

  remove(path: string): void {
    this.database.runQuery(
      this.database.kysely
        .deleteFrom("editor_export_videos")
        .where("path", "=", path),
    );
  }

  upsert(record: EditorExportOwnershipRecord): void {
    const timestamp = new Date().toISOString();
    this.database.runQuery(
      this.database.kysely
        .insertInto("editor_export_videos")
        .values({
          created_at: timestamp,
          device_id: record.deviceId,
          inode: record.inode,
          modified_at_ms: record.modifiedAtMs,
          path: record.path,
          size_bytes: record.sizeBytes,
          updated_at: timestamp,
        })
        .onConflict((conflict) =>
          conflict.column("path").doUpdateSet({
            device_id: record.deviceId,
            inode: record.inode,
            modified_at_ms: record.modifiedAtMs,
            size_bytes: record.sizeBytes,
            updated_at: timestamp,
          }),
        ),
    );
  }
}

function mapEditorExportOwnershipRow(
  row: EditorExportOwnershipRow,
): EditorExportOwnershipRecord {
  return {
    deviceId: Number(row.device_id),
    inode: Number(row.inode),
    modifiedAtMs: row.modified_at_ms,
    path: row.path,
    sizeBytes: row.size_bytes,
  };
}

export type { EditorExportOwnershipRecord };
export { EditorExportOwnershipRepository };
