import type { ColumnDef } from "@tanstack/react-table";
import { useMemo } from "react";

import {
  formatBytes,
  formatDateTime,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { RecordingTableActions } from "../../RecordingTableActions/RecordingTableActions";
import {
  canOpenRecordingRow,
  type RecordingTableRow,
  resolveRecordingTableColumnIds,
} from "../RecordingsPanel.utils";

interface UseRecordingsPanelColumnsInput {
  showLeagueColumn: boolean;
}

function useRecordingsPanelColumns({
  showLeagueColumn,
}: UseRecordingsPanelColumnsInput): ColumnDef<RecordingTableRow>[] {
  return useMemo<ColumnDef<RecordingTableRow>[]>(() => {
    return resolveRecordingTableColumnIds(showLeagueColumn).map((columnId) => {
      switch (columnId) {
        case "select":
          return {
            id: "select",
            enableSorting: false,
            header: ({ table }) => (
              <input
                aria-label="Select all recordings on this page"
                checked={table.getIsAllPageRowsSelected()}
                className="checkbox checkbox-sm"
                type="checkbox"
                onChange={table.getToggleAllPageRowsSelectedHandler()}
              />
            ),
            cell: ({ row }) => (
              <input
                aria-label={`Select recording ${row.original.fileName}`}
                checked={row.getIsSelected()}
                className="checkbox checkbox-sm"
                disabled={!row.getCanSelect()}
                type="checkbox"
                onChange={row.getToggleSelectedHandler()}
              />
            ),
          };
        case "fileName":
          return {
            accessorKey: "fileName",
            header: "Name",
            cell: ({ row, getValue }) => (
              <div className="flex min-w-0 items-center gap-2">
                <span className="truncate" title={row.original.path}>
                  {getValue<string>()}
                </span>
                {!row.original.exists && (
                  <span className="badge badge-error badge-xs">Missing</span>
                )}
              </div>
            ),
          };
        case "tableStatus":
          return {
            accessorKey: "tableStatus",
            enableSorting: false,
            header: "Status",
            cell: ({ row }) => (
              <span
                className={
                  row.original.tableStatus === "processing"
                    ? "badge badge-warning badge-xs"
                    : "badge badge-success badge-xs"
                }
              >
                {row.original.tableStatus === "processing"
                  ? "Processing"
                  : "Saved"}
              </span>
            ),
          };
        case "createdAt":
          return {
            accessorKey: "createdAt",
            header: "Saved",
            cell: ({ row, getValue }) =>
              row.original.tableStatus === "processing"
                ? "--"
                : formatDateTime(getValue<string>()),
          };
        case "sourceLeague":
          return {
            accessorKey: "sourceLeague",
            header: "League",
          };
        case "durationSeconds":
          return {
            accessorKey: "durationSeconds",
            header: "Length",
            cell: ({ getValue }) =>
              formatDurationSeconds(getValue<number | null>()),
          };
        case "sizeBytes":
          return {
            accessorKey: "sizeBytes",
            header: "Size",
            cell: ({ row, getValue }) =>
              row.original.tableStatus === "processing"
                ? "--"
                : formatBytes(getValue<number>()),
          };
        case "actions":
          return {
            id: "actions",
            enableSorting: false,
            header: "Actions",
            cell: ({ row }) => (
              <RecordingTableActions
                disabled={!canOpenRecordingRow(row.original)}
                recording={row.original}
              />
            ),
          };
        default: {
          const exhaustiveColumnId: never = columnId;

          return exhaustiveColumnId;
        }
      }
    });
  }, [showLeagueColumn]);
}

export { useRecordingsPanelColumns };
