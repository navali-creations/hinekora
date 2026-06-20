type MediaLibrarySortDirection = "asc" | "desc";

interface MediaLibraryPageQuery<
  TSortKey extends string,
  TSortDirection extends MediaLibrarySortDirection,
> {
  pageIndex?: number;
  pageSize?: number;
  sortBy?: TSortKey;
  sortDirection?: TSortDirection;
}

interface NormalizedMediaLibraryPageQuery<
  TSortKey extends string,
  TSortDirection extends MediaLibrarySortDirection,
> {
  pageIndex: number;
  pageSize: number;
  sortBy: TSortKey;
  sortDirection: TSortDirection;
}

function normalizeMediaLibraryPageQuery<
  TSortKey extends string,
  TSortDirection extends MediaLibrarySortDirection,
>(
  query: MediaLibraryPageQuery<TSortKey, TSortDirection>,
  defaults: NormalizedMediaLibraryPageQuery<TSortKey, TSortDirection>,
): NormalizedMediaLibraryPageQuery<TSortKey, TSortDirection> {
  return {
    pageIndex: Math.max(0, query.pageIndex ?? defaults.pageIndex),
    pageSize: Math.max(1, query.pageSize ?? defaults.pageSize),
    sortBy: query.sortBy ?? defaults.sortBy,
    sortDirection: query.sortDirection ?? defaults.sortDirection,
  };
}

export { normalizeMediaLibraryPageQuery };
