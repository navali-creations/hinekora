import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import {
  assertNumber,
  assertObject,
  assertString,
  handleValidationError,
  IpcValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { GameIdSchema } from "~/types";
import { RecordingStorageChannel } from "./RecordingStorage.channels";
import { RECORDING_STORAGE_LOG_SCOPE } from "./RecordingStorage.constants";
import type {
  RecordingStorageBatchFileActionResult,
  RecordingStorageFileActionResult,
  RecordingStorageUsage,
  RunRecordingDetail,
  RunRecordingLibraryPage,
  RunRecordingLibraryQuery,
  RunRecordingLibrarySortDirection,
  RunRecordingLibrarySortKey,
} from "./RecordingStorage.dto";

const maxLibraryPageSize = 100;
const librarySortKeys: RunRecordingLibrarySortKey[] = [
  "createdAt",
  "durationSeconds",
  "fileName",
  "sizeBytes",
  "sourceLeague",
];
const librarySortDirections: RunRecordingLibrarySortDirection[] = [
  "asc",
  "desc",
];

interface RecordingStorageIpcDependencies {
  copyRecordingToClipboard: (
    path: string,
  ) => Promise<RecordingStorageFileActionResult>;
  deleteManyRecordings: (
    paths: string[],
  ) => Promise<RecordingStorageBatchFileActionResult>;
  deleteRecording: (path: string) => Promise<RecordingStorageFileActionResult>;
  getRecording: (id: string) => RunRecordingDetail | null;
  getUsage: () => Promise<RecordingStorageUsage>;
  listRecordingLibrary: (
    query: RunRecordingLibraryQuery,
  ) => RunRecordingLibraryPage;
  openRecording: (path: string) => Promise<RecordingStorageFileActionResult>;
  revealRecording: (path: string) => RecordingStorageFileActionResult;
}

function setupRecordingStorageIpcHandlers(
  dependencies: RecordingStorageIpcDependencies,
): void {
  registerGuardedIpcHandler(
    RecordingStorageChannel.GetRecording,
    [WindowName.Main],
    (_event, id: unknown) => {
      try {
        assertString(id, "recording id", RecordingStorageChannel.GetRecording, {
          min: 1,
          max: 2_048,
        });

        return dependencies.getRecording(id);
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerGuardedIpcHandler(
    RecordingStorageChannel.GetUsage,
    [WindowName.Main],
    async () => {
      try {
        return await dependencies.getUsage();
      } catch (error) {
        logWarn(RECORDING_STORAGE_LOG_SCOPE, "Storage usage read failed", {
          errorType: error instanceof Error ? error.name : "unknown",
        });
        return {
          ok: false as const,
          error: "Recording storage usage is unavailable",
        };
      }
    },
  );
  registerGuardedIpcHandler(
    RecordingStorageChannel.ListRecordingLibrary,
    [WindowName.Main],
    (_event, query: unknown) => {
      try {
        return dependencies.listRecordingLibrary(
          validateRecordingLibraryQuery(query),
        );
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
  registerPathHandler(
    RecordingStorageChannel.OpenRecording,
    dependencies.openRecording,
  );
  registerPathHandler(
    RecordingStorageChannel.RevealRecording,
    dependencies.revealRecording,
  );
  registerPathHandler(
    RecordingStorageChannel.CopyRecording,
    dependencies.copyRecordingToClipboard,
  );
  registerPathHandler(
    RecordingStorageChannel.DeleteRecording,
    dependencies.deleteRecording,
  );
  registerGuardedIpcHandler(
    RecordingStorageChannel.DeleteManyRecordings,
    [WindowName.Main],
    (_event, paths: unknown) => {
      try {
        return dependencies.deleteManyRecordings(
          validateRecordingPathList(paths),
        );
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
}

function registerPathHandler(
  channel:
    | typeof RecordingStorageChannel.CopyRecording
    | typeof RecordingStorageChannel.DeleteRecording
    | typeof RecordingStorageChannel.OpenRecording
    | typeof RecordingStorageChannel.RevealRecording,
  handler: (
    path: string,
  ) =>
    | RecordingStorageFileActionResult
    | Promise<RecordingStorageFileActionResult>,
): void {
  registerGuardedIpcHandler(
    channel,
    [WindowName.Main],
    (_event, path: unknown) => {
      try {
        assertString(path, "recording path", channel, {
          min: 1,
          max: 2_048,
        });

        return handler(path);
      } catch (error) {
        return handleValidationError(error);
      }
    },
  );
}

function validateRecordingLibraryQuery(
  value: unknown,
): RunRecordingLibraryQuery {
  if (value === undefined) {
    return {};
  }

  assertObject(
    value,
    "recording library query",
    RecordingStorageChannel.ListRecordingLibrary,
  );
  const query: RunRecordingLibraryQuery = {};
  if (value.game !== undefined) {
    assertString(
      value.game,
      "game",
      RecordingStorageChannel.ListRecordingLibrary,
      { min: 1, max: 16 },
    );
    const game = GameIdSchema.safeParse(value.game);
    if (!game.success) {
      throw new IpcValidationError(
        RecordingStorageChannel.ListRecordingLibrary,
        "game is invalid",
      );
    }
    query.game = game.data;
  }
  if (value.league !== undefined) {
    assertString(
      value.league,
      "league",
      RecordingStorageChannel.ListRecordingLibrary,
      { min: 1, max: 80 },
    );
    query.league = value.league;
  }
  if (value.pageIndex !== undefined) {
    assertNumber(
      value.pageIndex,
      "page index",
      RecordingStorageChannel.ListRecordingLibrary,
      { integer: true, min: 0, max: 10_000 },
    );
    query.pageIndex = value.pageIndex;
  }
  if (value.pageSize !== undefined) {
    assertNumber(
      value.pageSize,
      "page size",
      RecordingStorageChannel.ListRecordingLibrary,
      { integer: true, min: 1, max: maxLibraryPageSize },
    );
    query.pageSize = value.pageSize;
  }
  if (value.sortBy !== undefined) {
    assertString(
      value.sortBy,
      "sort field",
      RecordingStorageChannel.ListRecordingLibrary,
      { min: 1, max: 32 },
    );
    if (!librarySortKeys.includes(value.sortBy as RunRecordingLibrarySortKey)) {
      throw new IpcValidationError(
        RecordingStorageChannel.ListRecordingLibrary,
        "sort field is invalid",
      );
    }
    query.sortBy = value.sortBy as RunRecordingLibrarySortKey;
  }
  if (value.sortDirection !== undefined) {
    assertString(
      value.sortDirection,
      "sort direction",
      RecordingStorageChannel.ListRecordingLibrary,
      { min: 1, max: 8 },
    );
    if (
      !librarySortDirections.includes(
        value.sortDirection as RunRecordingLibrarySortDirection,
      )
    ) {
      throw new IpcValidationError(
        RecordingStorageChannel.ListRecordingLibrary,
        "sort direction is invalid",
      );
    }
    query.sortDirection =
      value.sortDirection as RunRecordingLibrarySortDirection;
  }

  return query;
}

function validateRecordingPathList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(
      RecordingStorageChannel.DeleteManyRecordings,
      "recording paths must be an array",
    );
  }
  if (value.length > 100) {
    throw new IpcValidationError(
      RecordingStorageChannel.DeleteManyRecordings,
      "recording paths is too large",
    );
  }

  return value.map((path) => {
    assertString(
      path,
      "recording path",
      RecordingStorageChannel.DeleteManyRecordings,
      { min: 1, max: 2_048 },
    );

    return path;
  });
}

export { setupRecordingStorageIpcHandlers };
