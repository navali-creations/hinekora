import type { EditorProjectSummary } from "~/main/modules/editor/Editor.dto";
import type { EditorProjectSavedEditSortKey } from "~/main/modules/editor/EditorProject.repository";

import type { GameId } from "~/types";

interface SavedEditItem extends EditorProjectSummary {
  historyEditCount: number;
  sizeBytes: number;
  sourceGame: GameId | null;
  sourceLeague: string | null;
}
type SavedEditsLibrarySortDirection = "asc" | "desc";
type SavedEditsLibrarySortKey = EditorProjectSavedEditSortKey;

interface SavedEditsLibraryQuery {
  game?: GameId;
  league?: string;
  pageIndex?: number;
  pageSize?: number;
  sortBy?: SavedEditsLibrarySortKey;
  sortDirection?: SavedEditsLibrarySortDirection;
}

interface SavedEditsLibraryPage {
  availableLeagues: string[];
  globalTotalCount: number;
  items: SavedEditItem[];
  pageCount: number;
  pageIndex: number;
  pageSize: number;
  sortBy: SavedEditsLibrarySortKey;
  sortDirection: SavedEditsLibrarySortDirection;
  totalCount: number;
}

interface SavedEditFileActionResult {
  error: string | null;
  status: "success" | "unavailable";
}

export type {
  SavedEditFileActionResult,
  SavedEditItem,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
  SavedEditsLibrarySortDirection,
  SavedEditsLibrarySortKey,
};
