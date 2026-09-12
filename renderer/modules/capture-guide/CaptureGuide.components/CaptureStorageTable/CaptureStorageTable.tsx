import {
  type ColumnDef,
  columnVisibilityFeature,
  flexRender,
  tableFeatures,
  useTable,
} from "@tanstack/react-table";
import clsx from "clsx";
import { AnimatePresence, motion } from "motion/react";
import { useMemo } from "react";

import type { ManagedRecordingStorageEstimate } from "~/main/modules/managed-recorder/ManagedRecorder.dto";

import {
  captureEstimateDurations,
  captureResolutionGuideOptions,
  formatEstimatedRecordingStorage,
} from "../../CaptureGuide.utils/CaptureGuide.utils";

interface CaptureStorageRow {
  dimensions: string;
  estimates: Record<number, string>;
  id: string;
  resolution: string;
}

const captureStorageTableFeatures = tableFeatures({
  columnVisibilityFeature,
});

type CaptureStorageColumnDef = ColumnDef<
  typeof captureStorageTableFeatures,
  CaptureStorageRow
>;

interface CaptureStorageTableProps {
  estimate: ManagedRecordingStorageEstimate | undefined;
  status: "error" | "loading" | "ready";
}

function CaptureStorageTable({ estimate, status }: CaptureStorageTableProps) {
  const rows = useMemo<CaptureStorageRow[]>(
    () =>
      captureResolutionGuideOptions.map((resolution) => {
        const estimateRow = estimate?.rows.find(
          (row) => row.resolution === resolution.value,
        );

        return {
          dimensions: `${resolution.width} x ${resolution.height}`,
          estimates: Object.fromEntries(
            captureEstimateDurations.map((duration) => {
              const estimatedBytes = estimateRow?.estimates.find(
                (item) => item.durationMinutes === duration.minutes,
              )?.estimatedBytes;
              let displayValue = status === "loading" ? "" : "Unavailable";
              if (estimatedBytes !== undefined) {
                displayValue = formatEstimatedRecordingStorage(estimatedBytes);
              }

              return [duration.minutes, displayValue];
            }),
          ),
          id: resolution.value,
          resolution: resolution.displayName,
        };
      }),
    [estimate, status],
  );
  const columns = useMemo<CaptureStorageColumnDef[]>(
    () => [
      {
        accessorKey: "resolution",
        cell: ({ row }) => (
          <div>
            <div className="font-semibold">{row.original.resolution}</div>
            <div className="text-base-content/45 text-xs">
              {row.original.dimensions}
            </div>
          </div>
        ),
        header: "Resolution",
        id: "resolution",
      },
      ...captureEstimateDurations.map<CaptureStorageColumnDef>((duration) => ({
        accessorFn: (row) => row.estimates[duration.minutes],
        header: duration.label,
        id: `duration-${duration.minutes}`,
      })),
    ],
    [],
  );
  const table = useTable({
    features: captureStorageTableFeatures,
    columns,
    data: rows,
    getRowId: (row) => row.id,
  });
  const isLoading = status === "loading";

  return (
    <div className="relative overflow-hidden rounded-md border border-base-content/10">
      <div className="overflow-x-auto">
        <table
          aria-busy={isLoading}
          aria-label="Estimated recording storage by resolution and duration"
          className="table table-fixed table-sm min-w-[68rem] bg-base-200"
        >
          <colgroup>
            <col className="w-40" />
            {captureEstimateDurations.map((duration) => (
              <col key={duration.minutes} />
            ))}
          </colgroup>
          <thead className="bg-base-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    className={clsx("text-right", {
                      "sticky left-0 z-20 w-40 bg-base-200 text-left shadow-[1px_0_0_0_color-mix(in_oklab,currentColor_12%,transparent)]":
                        header.column.id === "resolution",
                      "whitespace-nowrap": header.column.id !== "resolution",
                    })}
                    data-sticky={
                      header.column.id === "resolution" ? "left" : undefined
                    }
                    key={header.id}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr
                className="group border-base-content/10 border-b last:border-b-0 hover:bg-base-300"
                key={row.id}
              >
                {row.getVisibleCells().map((cell) => (
                  <td
                    className={clsx("text-right tabular-nums", {
                      "sticky left-0 z-10 w-40 bg-base-200 text-left shadow-[1px_0_0_0_color-mix(in_oklab,currentColor_12%,transparent)] group-hover:bg-base-300":
                        cell.column.id === "resolution",
                    })}
                    data-sticky={
                      cell.column.id === "resolution" ? "left" : undefined
                    }
                    key={cell.id}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <AnimatePresence initial={false}>
        {isLoading && (
          <motion.div
            animate={{ opacity: 1 }}
            aria-label="Calculating storage estimates"
            className="pointer-events-none absolute inset-0 z-30 grid place-items-center bg-base-200/35 backdrop-blur-sm"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
            role="status"
            transition={{ duration: 0.16, ease: "easeOut" }}
          >
            <span
              aria-hidden="true"
              className="loading loading-spinner loading-md text-primary"
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export { CaptureStorageTable };
