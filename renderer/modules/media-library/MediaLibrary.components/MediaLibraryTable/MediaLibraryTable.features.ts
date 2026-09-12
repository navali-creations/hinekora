import {
  type ColumnDef,
  columnVisibilityFeature,
  type ReactTable,
  type RowData,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
  tableFeatures,
} from "@tanstack/react-table";

const mediaLibraryTableFeatures = tableFeatures({
  columnVisibilityFeature,
  rowPaginationFeature,
  rowSelectionFeature,
  rowSortingFeature,
});

type MediaLibraryColumnDef<TData extends RowData> = ColumnDef<
  typeof mediaLibraryTableFeatures,
  TData
>;

type MediaLibraryReactTable<TData extends RowData> = ReactTable<
  typeof mediaLibraryTableFeatures,
  TData
>;

export {
  type MediaLibraryColumnDef,
  type MediaLibraryReactTable,
  mediaLibraryTableFeatures,
};
