interface SavedVideoItem {
  fileName: string;
  id: string;
  savedAt: string;
  sizeBytes: number;
}

type SavedVideosLibrarySortDirection = "asc" | "desc";
type SavedVideosLibrarySortKey = "fileName" | "savedAt" | "sizeBytes";

interface SavedVideosLibraryQuery {
  pageIndex?: number;
  pageSize?: number;
  sortBy?: SavedVideosLibrarySortKey;
  sortDirection?: SavedVideosLibrarySortDirection;
}

interface SavedVideosLibraryPage {
  isTruncated: boolean;
  items: SavedVideoItem[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  sortBy: SavedVideosLibrarySortKey;
  sortDirection: SavedVideosLibrarySortDirection;
  totalCount: number;
}

interface SavedVideoFileActionResult {
  error: string | null;
  ok: boolean;
}

export type {
  SavedVideoFileActionResult,
  SavedVideoItem,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
  SavedVideosLibrarySortDirection,
  SavedVideosLibrarySortKey,
};
