import type {
  SavedEditItem,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
} from "~/main/modules/saved-edits";

interface SavedEditsSlice {
  savedEdits: {
    error: string | null;
    items: SavedEditItem[];
    libraryPage: SavedEditsLibraryPage | null;
    libraryPendingQuery: SavedEditsLibraryQuery | null;
    libraryQuery: SavedEditsLibraryQuery | null;
    deleteAllEdits: () => Promise<void>;
    deleteEdit: (projectId: string) => Promise<void>;
    hydrateLibrary: (
      query: SavedEditsLibraryQuery,
      options?: { mode?: "append" | "replace" },
    ) => Promise<void>;
    revealEditInExplorer: (projectId: string) => Promise<void>;
    refreshLibrary: () => Promise<void>;
  };
}

export type { SavedEditsSlice };
