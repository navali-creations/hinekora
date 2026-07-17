import type { DatabaseService } from "~/main/modules/database";
import { createStoragePathKey } from "~/main/utils/storage-path-key";

class StorageFileDeletionRepository {
  constructor(private readonly database: DatabaseService) {}

  markCommitted(operationId: string, storageRoot: string): void {
    this.database.runQuery(
      this.database.kysely
        .insertInto("storage_file_deletion_operations")
        .values({
          committed_at: new Date().toISOString(),
          operation_id: operationId,
          storage_root: createStoragePathKey(storageRoot),
        })
        .onConflict((conflict) => conflict.column("operation_id").doNothing()),
    );
  }

  isCommitted(operationId: string, storageRoot: string): boolean {
    return (
      this.database.queryOne(
        this.database.kysely
          .selectFrom("storage_file_deletion_operations")
          .select("operation_id")
          .where("operation_id", "=", operationId)
          .where("storage_root", "=", createStoragePathKey(storageRoot)),
      ) !== undefined
    );
  }

  complete(operationId: string, storageRoot?: string): void {
    let query = this.database.kysely
      .deleteFrom("storage_file_deletion_operations")
      .where("operation_id", "=", operationId);
    if (storageRoot) {
      query = query.where(
        "storage_root",
        "=",
        createStoragePathKey(storageRoot),
      );
    }
    this.database.runQuery(query);
  }
}

export { StorageFileDeletionRepository };
