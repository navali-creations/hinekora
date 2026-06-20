import type {
  BoundStoreStateCreator,
  ReplayClipsSlice,
} from "~/renderer/store/store.types";

import type { ReplayClip } from "~/types";

interface ReplayClipRefreshOptions {
  activeClip?: ReplayClip | null;
  clearSelection?: boolean;
  deletedIds?: string[];
}

export const createReplayClipsSlice: BoundStoreStateCreator<
  ReplayClipsSlice
> = (set, get) => {
  const refreshReplayClipState = async (
    options: ReplayClipRefreshOptions = {},
  ) => {
    const query = get().replayClips.libraryQuery;
    const [items, libraryPage] = await Promise.all([
      window.electron.replayClips.list(),
      query ? window.electron.replayClips.listLibrary(query) : null,
    ]);
    const deletedIds = new Set(options.deletedIds ?? []);

    set((state) => {
      if (options.clearSelection) {
        state.replayClips.selectedClipIds = {};
      }
      for (const id of deletedIds) {
        delete state.replayClips.selectedClipIds[id];
      }

      const nextActiveClip = Object.hasOwn(options, "activeClip")
        ? (options.activeClip ?? null)
        : state.replayClips.activeClip &&
            deletedIds.has(state.replayClips.activeClip.id)
          ? null
          : state.replayClips.activeClip;

      state.replayClips.activeClip = nextActiveClip;
      state.replayClips.items = items;
      state.replayClips.libraryItems =
        libraryPage?.items ?? state.replayClips.libraryItems;
      state.replayClips.libraryLeagues =
        libraryPage?.availableLeagues ?? state.replayClips.libraryLeagues;
      state.replayClips.libraryPage =
        libraryPage ?? state.replayClips.libraryPage;
      state.replayClips.error = null;
    });
  };

  return {
    replayClips: {
      items: [],
      libraryQuery: null,
      libraryPage: null,
      libraryItems: [],
      libraryLeagues: [],
      activeClip: null,
      selectedClipIds: {},
      error: null,
      hydrate: async () => {
        const items = await window.electron.replayClips.list();
        set((state) => {
          state.replayClips.items = items;
          state.replayClips.error = null;
        });
      },
      hydrateLibrary: async (query) => {
        const libraryPage =
          await window.electron.replayClips.listLibrary(query);
        set((state) => {
          state.replayClips.libraryQuery = query;
          state.replayClips.libraryPage = libraryPage;
          state.replayClips.libraryItems = libraryPage.items;
          state.replayClips.libraryLeagues = libraryPage.availableLeagues;
          state.replayClips.selectedClipIds = {};
          state.replayClips.error = null;
        });
      },
      refreshLibrary: async () => {
        const query = get().replayClips.libraryQuery;
        if (!query) {
          return;
        }

        const libraryPage =
          await window.electron.replayClips.listLibrary(query);
        set((state) => {
          state.replayClips.libraryPage = libraryPage;
          state.replayClips.libraryItems = libraryPage.items;
          state.replayClips.libraryLeagues = libraryPage.availableLeagues;
          state.replayClips.error = null;
        });
      },
      saveManual: async () => {
        const clip = await window.electron.replayClips.saveManual();
        await refreshReplayClipState({
          activeClip: clip ?? get().replayClips.activeClip,
        });
      },
      openClip: async (id: string) => {
        await window.electron.replayClips.open(id);
      },
      revealClip: async (id: string) => {
        await window.electron.replayClips.reveal(id);
      },
      deleteClip: async (id: string) => {
        const result = await window.electron.replayClips.delete(id);
        if (!result.ok) {
          set((state) => {
            state.replayClips.error = result.error ?? "Clip delete failed";
          });
          return;
        }

        await refreshReplayClipState({ deletedIds: [id] });
        set((state) => {
          state.replayClips.error = result.cleanupError ?? null;
        });
      },
      deleteSelectedClips: async () => {
        const selectedIds = Object.entries(get().replayClips.selectedClipIds)
          .filter(([, selected]) => selected)
          .map(([id]) => id);

        if (selectedIds.length === 0) {
          return;
        }

        const result =
          await window.electron.replayClips.deleteMany(selectedIds);
        await refreshReplayClipState({
          clearSelection: true,
          deletedIds: result.deletedIds,
        });
        set((state) => {
          state.replayClips.error =
            result.cleanupErrors?.[0]?.error ??
            (result.ok ? null : result.error);
        });
      },
      setSelectedClipIds: (ids) => {
        set((state) => {
          state.replayClips.selectedClipIds = ids;
        });
      },
      clearSelectedClips: () => {
        set((state) => {
          state.replayClips.selectedClipIds = {};
        });
      },
      startListening: () =>
        window.electron.replayClips.onStatusChanged((clip) => {
          void refreshReplayClipState({ activeClip: clip });
        }),
    },
  };
};
