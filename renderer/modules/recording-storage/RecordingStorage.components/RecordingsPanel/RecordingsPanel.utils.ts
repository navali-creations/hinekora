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

type RecordingTableRowStatus = "processing" | "recording" | "saved";
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

interface CreateTransientRunRecordingRowInput {
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

function getRecordingTableStatusBadgeClassName(
  status: RecordingTableRowStatus,
): string {
  return clsx("badge badge-xs", {
    "badge-success": status === "saved",
    "badge-warning": status !== "saved",
  });
}

function formatRecordingTableStatus(status: RecordingTableRowStatus): string {
  switch (status) {
    case "processing":
      return "Processing";
    case "recording":
      return "Recording";
    case "saved":
      return "Saved";
  }
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

function createTransientRunRecordingRow({
  now,
  scope,
  status,
}: CreateTransientRunRecordingRowInput): RecordingTableRow | null {
  const session = status?.runRecordingSession;
  if (!session || session.sourceGame !== scope.game) {
    return null;
  }

  const sourceLeague = session.sourceLeague;
  if (scope.league !== ALL_LEAGUES_VALUE && sourceLeague !== scope.league) {
    return null;
  }

  const startedAtMs = Date.parse(session.startedAt);
  const stoppedAtMs = session.stoppedAt
    ? Date.parse(session.stoppedAt)
    : now.getTime();
  const durationSeconds =
    Number.isFinite(startedAtMs) && Number.isFinite(stoppedAtMs)
      ? Math.max(0, (stoppedAtMs - startedAtMs) / 1_000)
      : null;
  const timestamp = now.toISOString();

  return {
    id: "__active-run-recording",
    path: session.path ?? "",
    sourceGame: session.sourceGame,
    sourceLeague,
    startedAt: session.startedAt,
    stoppedAt: session.stoppedAt ?? timestamp,
    createdAt: session.startedAt,
    updatedAt: timestamp,
    fileName:
      session.state === "processing"
        ? "Processing recording"
        : "Active recording",
    durationSeconds,
    framesPerSecond: session.framesPerSecond,
    sizeBytes: 0,
    exists: true,
    tableStatus: session.state,
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
    row.tableStatus !== "saved" &&
      "bg-warning/5 text-base-content/55 hover:bg-warning/10",
  );
}

export type { RecordingTableColumnId, RecordingTableRow };
export {
  canOpenRecordingRow,
  createTransientRunRecordingRow,
  formatRecordingTableStatus,
  getCellClassName,
  getHeaderClassName,
  getRecordingRowClassName,
  getRecordingTableStatusBadgeClassName,
  resolveRecordingTableColumnIds,
  resolveSortBy,
  toRecordingTableRow,
};
