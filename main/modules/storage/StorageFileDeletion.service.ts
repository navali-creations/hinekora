import type { DatabaseService } from "~/main/modules/database";
import {
  finalizeStagedFileDeletions,
  getStagedFileDeletionOperationId,
  recoverStagedFileDeletions,
  type StagedFileDeletion,
} from "~/main/utils/staged-file-deletion";

import { StorageFileDeletionRepository } from "./StorageFileDeletion.repository";

class StorageFileDeletionService {
  private readonly repository: StorageFileDeletionRepository;

  constructor(database: DatabaseService) {
    this.repository = new StorageFileDeletionRepository(database);
  }

  markCommitted(stagedFiles: StagedFileDeletion[], storageRoot: string): void {
    const operationId = getStagedFileDeletionOperationId(stagedFiles);
    if (operationId) {
      this.repository.markCommitted(operationId, storageRoot);
    }
  }

  finalize(stagedFiles: StagedFileDeletion[]) {
    return finalizeStagedFileDeletions(stagedFiles, {
      completeOperation: (operationId) => this.repository.complete(operationId),
    });
  }

  recover(storageRoot: string) {
    return recoverStagedFileDeletions(storageRoot, {
      completeOperation: (operationId) =>
        this.repository.complete(operationId, storageRoot),
      isOperationCommitted: (operationId) =>
        this.repository.isCommitted(operationId, storageRoot),
    });
  }
}

export { StorageFileDeletionService };
