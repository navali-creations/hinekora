import { editorProjectSavedEditSortKeys } from "~/main/modules/editor/EditorProject.repository";
import {
  assertNumber,
  assertObject,
  assertString,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import { GameIdSchema } from "~/types";
import { SavedEditsChannel } from "./SavedEdits.channels";
import type {
  SavedEditsLibraryQuery,
  SavedEditsLibrarySortDirection,
  SavedEditsLibrarySortKey,
} from "./SavedEdits.dto";

const maxSavedEditsLibraryPageSize = 100;
const savedEditsLibrarySortKeys: SavedEditsLibrarySortKey[] = [
  ...editorProjectSavedEditSortKeys,
];
const savedEditsLibrarySortDirections: SavedEditsLibrarySortDirection[] = [
  "asc",
  "desc",
];

function validateSavedEditsLibraryQuery(
  value: unknown,
): SavedEditsLibraryQuery {
  if (value === undefined) {
    return {};
  }

  assertObject(
    value,
    "saved edits library query",
    SavedEditsChannel.ListLibrary,
  );

  const query: SavedEditsLibraryQuery = {};
  if (value.game !== undefined) {
    assertString(value.game, "game", SavedEditsChannel.ListLibrary, {
      min: 1,
      max: 8,
    });
    const game = GameIdSchema.safeParse(value.game);
    if (!game.success) {
      throw new IpcValidationError(
        SavedEditsChannel.ListLibrary,
        "game is invalid",
      );
    }
    query.game = game.data;
  }
  if (value.league !== undefined) {
    assertString(value.league, "league", SavedEditsChannel.ListLibrary, {
      min: 1,
      max: 80,
    });
    query.league = value.league;
  }
  if (value.pageIndex !== undefined) {
    assertNumber(value.pageIndex, "page index", SavedEditsChannel.ListLibrary, {
      integer: true,
      min: 0,
      max: 10_000,
    });
    query.pageIndex = value.pageIndex;
  }
  if (value.pageSize !== undefined) {
    assertNumber(value.pageSize, "page size", SavedEditsChannel.ListLibrary, {
      integer: true,
      min: 1,
      max: maxSavedEditsLibraryPageSize,
    });
    query.pageSize = value.pageSize;
  }
  if (value.sortBy !== undefined) {
    assertString(value.sortBy, "sort field", SavedEditsChannel.ListLibrary, {
      min: 1,
      max: 32,
    });
    if (
      !savedEditsLibrarySortKeys.includes(
        value.sortBy as SavedEditsLibrarySortKey,
      )
    ) {
      throw new IpcValidationError(
        SavedEditsChannel.ListLibrary,
        "sort field is invalid",
      );
    }
    query.sortBy = value.sortBy as SavedEditsLibrarySortKey;
  }
  if (value.sortDirection !== undefined) {
    assertString(
      value.sortDirection,
      "sort direction",
      SavedEditsChannel.ListLibrary,
      { min: 1, max: 8 },
    );
    if (
      !savedEditsLibrarySortDirections.includes(
        value.sortDirection as SavedEditsLibrarySortDirection,
      )
    ) {
      throw new IpcValidationError(
        SavedEditsChannel.ListLibrary,
        "sort direction is invalid",
      );
    }
    query.sortDirection = value.sortDirection as SavedEditsLibrarySortDirection;
  }

  return query;
}

function validateSavedEditProjectId(
  value: unknown,
  channel: SavedEditsChannel,
): string {
  assertString(value, "project id", channel, {
    min: 1,
    max: 128,
  });

  return value;
}

export {
  maxSavedEditsLibraryPageSize,
  savedEditsLibrarySortDirections,
  savedEditsLibrarySortKeys,
  validateSavedEditProjectId,
  validateSavedEditsLibraryQuery,
};
