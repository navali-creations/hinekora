import {
  assertNumber,
  assertObject,
  assertOptionalBoolean,
  assertString,
  IpcValidationError,
} from "~/main/utils/ipc-validation";

import {
  GameIdSchema,
  quickClipTrimMaximumSeconds,
  quickClipTrimMinimumSeconds,
  ReplayClipKindSchema,
} from "~/types";
import { ReplayClipsChannel } from "./ReplayClips.channels";
import type {
  ReplayClipCopyInput,
  ReplayClipLibraryQuery,
  ReplayClipLibrarySortDirection,
  ReplayClipLibrarySortKey,
  ReplayClipListFilter,
  ReplayClipTrimInput,
  ReplayClipUpdateInput,
} from "./ReplayClips.dto";

const maxLibraryPageSize = 100;
const maxReplayClipRenameLength = 120;
const librarySortKeys: ReplayClipLibrarySortKey[] = [
  "createdAt",
  "name",
  "sourceLeague",
  "targetDurationSeconds",
  "sizeBytes",
];
const librarySortDirections: ReplayClipLibrarySortDirection[] = ["asc", "desc"];

function validateReplayClipLibraryQuery(
  value: unknown,
): ReplayClipLibraryQuery {
  if (value === undefined) {
    return {};
  }

  assertObject(value, "clip library query", ReplayClipsChannel.ListLibrary);
  const filter = validateListFilterForChannel(
    value,
    ReplayClipsChannel.ListLibrary,
  );
  const query: ReplayClipLibraryQuery = { ...filter };

  if (value.pageIndex !== undefined) {
    assertNumber(
      value.pageIndex,
      "page index",
      ReplayClipsChannel.ListLibrary,
      { integer: true, min: 0, max: 10_000 },
    );
    query.pageIndex = value.pageIndex;
  }
  if (value.pageSize !== undefined) {
    assertNumber(value.pageSize, "page size", ReplayClipsChannel.ListLibrary, {
      integer: true,
      min: 1,
      max: maxLibraryPageSize,
    });
    query.pageSize = value.pageSize;
  }
  if (value.sortBy !== undefined) {
    assertString(value.sortBy, "sort field", ReplayClipsChannel.ListLibrary, {
      min: 1,
      max: 32,
    });
    if (!librarySortKeys.includes(value.sortBy as ReplayClipLibrarySortKey)) {
      throw new IpcValidationError(
        ReplayClipsChannel.ListLibrary,
        "sort field is invalid",
      );
    }
    query.sortBy = value.sortBy as ReplayClipLibrarySortKey;
  }
  if (value.sortDirection !== undefined) {
    assertString(
      value.sortDirection,
      "sort direction",
      ReplayClipsChannel.ListLibrary,
      { min: 1, max: 8 },
    );
    if (
      !librarySortDirections.includes(
        value.sortDirection as ReplayClipLibrarySortDirection,
      )
    ) {
      throw new IpcValidationError(
        ReplayClipsChannel.ListLibrary,
        "sort direction is invalid",
      );
    }
    query.sortDirection = value.sortDirection as ReplayClipLibrarySortDirection;
  }

  return query;
}

function validateReplayClipUpdateInput(value: unknown): ReplayClipUpdateInput {
  assertObject(value, "clip update", ReplayClipsChannel.Update);
  assertString(value.id, "id", ReplayClipsChannel.Update, {
    min: 1,
    max: 128,
  });

  const input: ReplayClipUpdateInput = { id: value.id };
  if (value.name !== undefined && value.name !== null) {
    assertString(value.name, "clip name", ReplayClipsChannel.Update, {
      max: maxReplayClipRenameLength,
    });
    input.name = value.name;
  }
  if (
    value.operationRequestId !== undefined &&
    value.operationRequestId !== null
  ) {
    assertString(
      value.operationRequestId,
      "operation request id",
      ReplayClipsChannel.Update,
      { min: 1, max: 128 },
    );
    input.operationRequestId = value.operationRequestId;
  }
  if (value.trim !== undefined && value.trim !== null) {
    input.trim = validateTrimInput(value.trim, ReplayClipsChannel.Update);
  }
  if (value.muteAudio !== undefined) {
    assertOptionalBoolean(
      value.muteAudio,
      "mute clip audio",
      ReplayClipsChannel.Update,
    );
    input.muteAudio = value.muteAudio;
  }

  return input;
}

function validateReplayClipCopyInput(value: unknown): ReplayClipCopyInput {
  if (typeof value === "string") {
    assertString(value, "id", ReplayClipsChannel.Copy, {
      min: 1,
      max: 128,
    });
    return { id: value };
  }

  assertObject(value, "clip copy", ReplayClipsChannel.Copy);
  assertString(value.id, "id", ReplayClipsChannel.Copy, {
    min: 1,
    max: 128,
  });

  const input: ReplayClipCopyInput = { id: value.id };
  if (
    value.operationRequestId !== undefined &&
    value.operationRequestId !== null
  ) {
    assertString(
      value.operationRequestId,
      "operation request id",
      ReplayClipsChannel.Copy,
      { min: 1, max: 128 },
    );
    input.operationRequestId = value.operationRequestId;
  }
  if (value.trim !== undefined && value.trim !== null) {
    input.trim = validateTrimInput(value.trim, ReplayClipsChannel.Copy);
  }
  if (value.muteAudio !== undefined) {
    assertOptionalBoolean(
      value.muteAudio,
      "mute clip audio",
      ReplayClipsChannel.Copy,
    );
    input.muteAudio = value.muteAudio;
  }

  return input;
}

function validateReplayClipIdList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    throw new IpcValidationError(
      ReplayClipsChannel.DeleteMany,
      "ids must be an array",
    );
  }
  if (value.length > 100) {
    throw new IpcValidationError(
      ReplayClipsChannel.DeleteMany,
      "ids is too large",
    );
  }

  return value.map((id) => {
    assertString(id, "id", ReplayClipsChannel.DeleteMany, {
      min: 1,
      max: 128,
    });
    return id;
  });
}

function validateTrimInput(
  value: unknown,
  channel: ReplayClipsChannel,
): ReplayClipTrimInput {
  assertObject(value, "trim", channel);
  assertNumber(value.inSeconds, "trim start", channel, {
    min: 0,
    max: quickClipTrimMaximumSeconds,
  });
  assertNumber(value.outSeconds, "trim end", channel, {
    min: quickClipTrimMinimumSeconds,
    max: quickClipTrimMaximumSeconds,
  });
  const trim = value as { inSeconds: number; outSeconds: number };
  if (trim.outSeconds - trim.inSeconds < quickClipTrimMinimumSeconds) {
    throw new IpcValidationError(channel, "trim range is too short");
  }

  return { inSeconds: trim.inSeconds, outSeconds: trim.outSeconds };
}

function validateListFilterForChannel(
  value: Record<string, unknown>,
  channel: ReplayClipsChannel,
): ReplayClipListFilter {
  const filter: ReplayClipListFilter = {};
  if (value.game !== undefined) {
    assertString(value.game, "game", channel, { min: 1, max: 16 });
    const game = GameIdSchema.safeParse(value.game);
    if (!game.success) {
      throw new IpcValidationError(channel, "game is invalid");
    }
    filter.game = game.data;
  }
  if (value.kind !== undefined) {
    assertString(value.kind, "clip kind", channel, { min: 1, max: 16 });
    const kind = ReplayClipKindSchema.safeParse(value.kind);
    if (!kind.success) {
      throw new IpcValidationError(channel, "clip kind is invalid");
    }
    filter.kind = kind.data;
  }
  if (value.league !== undefined) {
    assertString(value.league, "league", channel, { min: 1, max: 80 });
    filter.league = value.league;
  }

  return filter;
}

export {
  validateReplayClipCopyInput,
  validateReplayClipIdList,
  validateReplayClipLibraryQuery,
  validateReplayClipUpdateInput,
};
