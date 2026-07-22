import {
  assertNumber,
  assertObject,
  assertString,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { SavedVideosChannel } from "./SavedVideos.channels";
import type {
  SavedVideosLibraryQuery,
  SavedVideosLibrarySortDirection,
  SavedVideosLibrarySortKey,
} from "./SavedVideos.dto";

const maxSavedVideosLibraryPageSize = 100;
const sortKeys: SavedVideosLibrarySortKey[] = [
  "fileName",
  "savedAt",
  "sizeBytes",
];
const sortDirections: SavedVideosLibrarySortDirection[] = ["asc", "desc"];

function validateSavedVideosLibraryQuery(
  value: unknown,
): SavedVideosLibraryQuery {
  if (value === undefined) {
    return {};
  }

  assertObject(
    value,
    "saved videos library query",
    SavedVideosChannel.ListLibrary,
  );
  const query: SavedVideosLibraryQuery = {};
  if (value.pageIndex !== undefined) {
    assertNumber(
      value.pageIndex,
      "page index",
      SavedVideosChannel.ListLibrary,
      {
        integer: true,
        min: 0,
        max: 10_000,
      },
    );
    query.pageIndex = value.pageIndex;
  }
  if (value.pageSize !== undefined) {
    assertNumber(value.pageSize, "page size", SavedVideosChannel.ListLibrary, {
      integer: true,
      min: 1,
      max: maxSavedVideosLibraryPageSize,
    });
    query.pageSize = value.pageSize;
  }
  if (value.sortBy !== undefined) {
    assertString(value.sortBy, "sort field", SavedVideosChannel.ListLibrary, {
      min: 1,
      max: 32,
    });
    if (!sortKeys.includes(value.sortBy as SavedVideosLibrarySortKey)) {
      throw new IpcValidationError(
        SavedVideosChannel.ListLibrary,
        "sort field is invalid",
      );
    }
    query.sortBy = value.sortBy as SavedVideosLibrarySortKey;
  }
  if (value.sortDirection !== undefined) {
    assertString(
      value.sortDirection,
      "sort direction",
      SavedVideosChannel.ListLibrary,
      { min: 1, max: 8 },
    );
    if (
      !sortDirections.includes(
        value.sortDirection as SavedVideosLibrarySortDirection,
      )
    ) {
      throw new IpcValidationError(
        SavedVideosChannel.ListLibrary,
        "sort direction is invalid",
      );
    }
    query.sortDirection =
      value.sortDirection as SavedVideosLibrarySortDirection;
  }

  return query;
}

function validateSavedVideoId(
  value: unknown,
  channel: SavedVideosChannel,
): string {
  assertString(value, "saved video id", channel, { min: 64, max: 64 });
  if (!/^[a-f0-9]{64}$/.test(value)) {
    throw new IpcValidationError(channel, "saved video id is invalid");
  }

  return value;
}

export { validateSavedVideoId, validateSavedVideosLibraryQuery };
