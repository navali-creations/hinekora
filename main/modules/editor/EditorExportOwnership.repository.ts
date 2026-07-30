import { sql } from "kysely";

import type { DatabaseService } from "~/main/modules/database";
import { createStoragePathAliasKeys } from "~/main/utils/storage-files";

import type { EditorExportFile } from "./EditorExport.inventory";
import {
  createEditorExportFileAliasKeyMap,
  hasSameRegisteredEditorExportIdentity,
} from "./EditorExport.ownership";

const maxEditorExportOwnershipRecords = 250_000;

interface EditorExportOwnershipRecord {
  deviceId: number;
  inode: number;
  modifiedAtMs: number;
  path: string;
  projectId: string | null;
  sizeBytes: number;
}

interface EditorExportOwnershipRow {
  device_id: string;
  inode: string;
  modified_at_ms: number;
  path: string;
  project_id: string | null;
  size_bytes: number;
}

class EditorExportOwnershipRepository {
  constructor(private readonly database: DatabaseService) {}

  list(limit = maxEditorExportOwnershipRecords): EditorExportOwnershipRecord[] {
    return this.database
      .queryAll<EditorExportOwnershipRow>(
        this.database.kysely
          .selectFrom("editor_export_videos")
          .select([
            sql<string>`CAST(device_id AS TEXT)`.as("device_id"),
            sql<string>`CAST(inode AS TEXT)`.as("inode"),
            "modified_at_ms",
            "path",
            "project_id",
            "size_bytes",
          ])
          .orderBy("updated_at", "desc")
          .limit(Math.max(0, limit)),
      )
      .map(mapEditorExportOwnershipRow);
  }

  remove(path: string): void {
    const targetPathKeys = new Set(createStoragePathAliasKeys(path));
    const paths = this.list()
      .filter((record) =>
        createStoragePathAliasKeys(record.path).some((key) =>
          targetPathKeys.has(key),
        ),
      )
      .map((record) => record.path);
    if (paths.length === 0) {
      paths.push(path);
    }
    this.removeExact(paths);
  }

  pruneStale(files: readonly EditorExportFile[]): number {
    const filesByAliasKey = createEditorExportFileAliasKeyMap(files);
    const stalePaths = this.list()
      .filter((record) => {
        const file = createStoragePathAliasKeys(record.path)
          .map((key) => filesByAliasKey.get(key))
          .find(
            (candidate): candidate is EditorExportFile =>
              candidate !== undefined,
          );
        return !file || !hasSameRegisteredEditorExportIdentity(record, file);
      })
      .map((record) => record.path);

    this.removeExact(stalePaths);
    return stalePaths.length;
  }

  private removeExact(paths: readonly string[]): void {
    if (paths.length === 0) {
      return;
    }
    this.database.runQuery(
      this.database.kysely
        .deleteFrom("editor_export_videos")
        .where("path", "in", [...paths]),
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
          project_id: record.projectId,
          size_bytes: record.sizeBytes,
          updated_at: timestamp,
        })
        .onConflict((conflict) =>
          conflict.column("path").doUpdateSet({
            device_id: record.deviceId,
            inode: record.inode,
            modified_at_ms: record.modifiedAtMs,
            project_id: record.projectId,
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
    projectId: row.project_id,
    sizeBytes: row.size_bytes,
  };
}

export type { EditorExportOwnershipRecord };
export { EditorExportOwnershipRepository };
