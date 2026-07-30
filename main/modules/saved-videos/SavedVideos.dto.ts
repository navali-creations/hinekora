import { z } from "zod";

interface SavedVideoItem {
  fileName: string;
  id: string;
  savedAt: string;
  sizeBytes: number;
  sourceProjectId: string | null;
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

const nonnegativeSavedVideosNumber = z.number().finite().nonnegative();
const SavedVideosLibrarySortKeySchema = z.enum([
  "fileName",
  "savedAt",
  "sizeBytes",
]);
const SavedVideosLibrarySortDirectionSchema = z.enum(["asc", "desc"]);
const SavedVideoItemSchema: z.ZodType<SavedVideoItem> = z.object({
  fileName: z.string().min(1).max(512),
  id: z.string().min(1).max(128),
  savedAt: z.string().min(1).max(64),
  sizeBytes: nonnegativeSavedVideosNumber,
  sourceProjectId: z.string().min(1).max(128).nullable(),
});
const SavedVideosLibraryPageSchema: z.ZodType<SavedVideosLibraryPage> =
  z.object({
    isTruncated: z.boolean(),
    items: z.array(SavedVideoItemSchema).max(100),
    pageCount: z.number().int().positive(),
    pageIndex: z.number().int().nonnegative(),
    pageSize: z.number().int().positive().max(100),
    sortBy: SavedVideosLibrarySortKeySchema,
    sortDirection: SavedVideosLibrarySortDirectionSchema,
    totalCount: z.number().int().nonnegative(),
  });
const SavedVideoFileActionResultSchema: z.ZodType<SavedVideoFileActionResult> =
  z.object({
    error: z.string().max(2_048).nullable(),
    ok: z.boolean(),
  });

export type {
  SavedVideoFileActionResult,
  SavedVideoItem,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
  SavedVideosLibrarySortDirection,
  SavedVideosLibrarySortKey,
};
export {
  SavedVideoFileActionResultSchema,
  SavedVideoItemSchema,
  SavedVideosLibraryPageSchema,
};
