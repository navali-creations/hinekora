import type {
  SavedVideoItem,
  SavedVideosLibraryPage,
  SavedVideosLibraryQuery,
} from "~/main/modules/saved-videos";

interface SavedVideosSlice {
  savedVideos: {
    deleteVideo: (id: string) => Promise<void>;
    error: string | null;
    hydrateLibrary: (query: SavedVideosLibraryQuery) => Promise<void>;
    items: SavedVideoItem[];
    libraryPage: SavedVideosLibraryPage | null;
    libraryQuery: SavedVideosLibraryQuery | null;
    openVideo: (id: string) => Promise<void>;
    refreshLibrary: () => Promise<void>;
    revealVideo: (id: string) => Promise<void>;
  };
}

export type { SavedVideosSlice };
