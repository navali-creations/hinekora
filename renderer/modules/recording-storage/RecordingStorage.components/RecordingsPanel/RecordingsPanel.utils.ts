import clsx from "clsx";

import type {
  RunRecordingItem,
  RunRecordingLibrarySortKey,
} from "~/main/modules/recording-storage/RecordingStorage.dto";
import {
  ALL_LEAGUES_VALUE,
  type MediaLibraryScope,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import type { ManagedRecorderStatus } from "~/types";

type RecordingTableRowStatus = "processing" | "saved";
type RecordingTableColumnId =
  | "actions"
  | "createdAt"
  | "durationSeconds"
  | "fileName"
  | "select"
  | "sizeBytes"
  | "sourceLeague"
  | "tableStatus";

type RecordingTableRow = RunRecordingItem & {
  tableStatus: RecordingTableRowStatus;
};

const baseRecordingTableColumnIds = [
  "select",
  "fileName",
  "tableStatus",
  "createdAt",
] as const satisfies readonly RecordingTableColumnId[];
const trailingRecordingTableColumnIds = [
  "durationSeconds",
  "sizeBytes",
  "actions",
] as const satisfies readonly RecordingTableColumnId[];

interface CreateProcessingRecordingRowInput {
  activeLeague: string | null;
  now: Date;
  scope: MediaLibraryScope;
  status: ManagedRecorderStatus | null;
}

function getHeaderClassName(columnId: string): string {
  return clsx(
    "sticky top-0 z-10 bg-base-200 text-base-content/55",
    columnId === "select" && "w-12 text-center",
    ["durationSeconds", "sizeBytes", "actions"].includes(columnId) &&
      "text-right",
  );
}

function getCellClassName(columnId: string): string {
  return clsx(
    columnId === "fileName" && "max-w-0",
    columnId === "select" && "text-center",
    columnId === "sourceLeague" && "whitespace-nowrap",
    columnId === "createdAt" && "whitespace-nowrap",
    columnId === "tableStatus" && "whitespace-nowrap",
    columnId === "durationSeconds" && "text-right tabular-nums",
    columnId === "sizeBytes" && "text-right tabular-nums",
    columnId === "actions" && "text-right",
  );
}

function resolveSortBy(
  columnId: string | undefined,
): RunRecordingLibrarySortKey {
  switch (columnId) {
    case "durationSeconds":
    case "fileName":
    case "sizeBytes":
    case "sourceLeague":
    case "createdAt":
      return columnId;
    default:
      return "createdAt";
  }
}

function createProcessingRecordingRow({
  activeLeague,
  now,
  scope,
  status,
}: CreateProcessingRecordingRowInput): RecordingTableRow | null {
  const startedAt = status?.runRecordingStartedAt ?? status?.recordingStartedAt;
  const sourceGame = status?.activeGame ?? null;
  const isProcessing =
    status?.runRecordingActive === true ||
    (status?.isStoppingRecording === true && startedAt !== null);
  if (!isProcessing || !startedAt || sourceGame !== scope.game) {
    return null;
  }

  const sourceLeague =
    activeLeague ??
    (scope.league === ALL_LEAGUES_VALUE ? "Standard" : scope.league);
  if (scope.league !== ALL_LEAGUES_VALUE && sourceLeague !== scope.league) {
    return null;
  }

  const startedAtMs = Date.parse(startedAt);
  const durationSeconds = Number.isFinite(startedAtMs)
    ? Math.max(0, (now.getTime() - startedAtMs) / 1_000)
    : null;
  const timestamp = now.toISOString();

  return {
    id: "__active-run-recording",
    path: status?.runRecordingPath ?? "",
    sourceGame,
    sourceLeague,
    startedAt,
    stoppedAt: timestamp,
    createdAt: startedAt,
    updatedAt: timestamp,
    fileName:
      status?.isStoppingRecording === true
        ? "Processing recording"
        : "Active recording",
    durationSeconds,
    sizeBytes: 0,
    exists: true,
    tableStatus: "processing",
  };
}

function resolveRecordingTableColumnIds(
  showLeagueColumn: boolean,
): RecordingTableColumnId[] {
  return [
    ...baseRecordingTableColumnIds,
    ...(showLeagueColumn ? (["sourceLeague"] as const) : []),
    ...trailingRecordingTableColumnIds,
  ];
}

function toRecordingTableRow(recording: RunRecordingItem): RecordingTableRow {
  return { ...recording, tableStatus: "saved" };
}

function canOpenRecordingRow(row: RecordingTableRow): boolean {
  return row.tableStatus === "saved";
}

function getRecordingRowClassName(row: RecordingTableRow): string {
  return clsx(
    row.tableStatus === "processing" &&
      "bg-warning/5 text-base-content/55 hover:bg-warning/10",
  );
}

export type { RecordingTableColumnId, RecordingTableRow };
export {
  canOpenRecordingRow,
  createProcessingRecordingRow,
  getCellClassName,
  getHeaderClassName,
  getRecordingRowClassName,
  resolveRecordingTableColumnIds,
  resolveSortBy,
  toRecordingTableRow,
};
