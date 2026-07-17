import type {
  ReplayClipLibraryQuery,
  ReplayClipView,
} from "~/main/modules/replay-clips/ReplayClips.dto";
import type {
  BoundStoreStateCreator,
  ReplayClipsSlice,
} from "~/renderer/store/store.types";

interface ReplayClipRefreshOptions {
  activeClip?: ReplayClipView | null;
  clearSelection?: boolean;
  deletedIds?: string[];
}

const REPLAY_CLIP_LIBRARY_REFRESH_DELAY_MS = 200;

function getReplayClipsError(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function replayClipMatchesLibraryQuery(
  clip: ReplayClipView,
  query: ReplayClipLibraryQuery | null,
): boolean {
  if (!query) {
    return false;
  }

  return (
    (!query.game || query.game === clip.sourceGame) &&
    (!query.league || query.league === clip.sourceLeague) &&
    (!query.kind || query.kind === clip.kind)
  );
}

export const createReplayClipsSlice: BoundStoreStateCreator<
  ReplayClipsSlice
> = (set, get) => {
  let libraryRefreshTimer: number | null = null;
  let libraryRequestGeneration = 0;

  const requestLibraryPage = async (
    query: ReplayClipLibraryQuery,
    options: { activateQuery?: boolean; clearSelection?: boolean } = {},
  ): Promise<boolean> => {
    const requestGeneration = ++libraryRequestGeneration;
    if (options.activateQuery) {
      set((state) => {
        state.replayClips.libraryQuery = query;
        if (options.clearSelection) {
          state.replayClips.selectedClipIds = {};
        }
        state.replayClips.error = null;
      });
    }

    try {
      const libraryPage = await window.electron.replayClips.listLibrary(query);
      if (requestGeneration !== libraryRequestGeneration) {
        return false;
      }

      set((state) => {
        state.replayClips.libraryPage = libraryPage;
        state.replayClips.libraryItems = libraryPage.items;
        state.replayClips.libraryLeagues = libraryPage.availableLeagues;
        state.replayClips.error = null;
      });
      return true;
    } catch (error) {
      if (requestGeneration === libraryRequestGeneration) {
        set((state) => {
          state.replayClips.error = getReplayClipsError(
            error,
            "Could not load clips.",
          );
        });
      }
      return false;
    }
  };

  const scheduleLibraryRefresh = () => {
    if (libraryRefreshTimer !== null) {
      window.clearTimeout(libraryRefreshTimer);
    }

    libraryRefreshTimer = window.setTimeout(() => {
      libraryRefreshTimer = null;
      void get().replayClips.refreshLibrary();
    }, REPLAY_CLIP_LIBRARY_REFRESH_DELAY_MS);
  };

  const patchReplayClipState = (clip: ReplayClipView) => {
    const query = get().replayClips.libraryQuery;
    let shouldRefreshLibrary = false;

    set((state) => {
      state.replayClips.activeClip = clip;
      state.replayClips.error = null;

      if (!query || !state.replayClips.libraryPage) {
        return;
      }

      const libraryIndex = state.replayClips.libraryItems.findIndex(
        (item) => item.id === clip.id,
      );
      const matchesLibrary = replayClipMatchesLibraryQuery(clip, query);
      if (libraryIndex >= 0 && matchesLibrary) {
        state.replayClips.libraryItems[libraryIndex] = clip;
      }

      if (libraryIndex >= 0 || matchesLibrary) {
        shouldRefreshLibrary = true;
      }
    });

    if (shouldRefreshLibrary) {
      scheduleLibraryRefresh();
    }
  };

  const refreshReplayClipState = async (
    options: ReplayClipRefreshOptions = {},
  ): Promise<boolean> => {
    const query = get().replayClips.libraryQuery;
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
    });

    return query ? requestLibraryPage(query) : true;
  };

  return {
    replayClips: {
      libraryQuery: null,
      libraryPage: null,
      libraryItems: [],
      libraryLeagues: [],
      activeClip: null,
      selectedClipIds: {},
      error: null,
      hydrateLibrary: async (query) => {
        await requestLibraryPage(query, {
          activateQuery: true,
          clearSelection: true,
        });
      },
      refreshLibrary: async () => {
        const query = get().replayClips.libraryQuery;
        if (!query) {
          return;
        }

        await requestLibraryPage(query);
      },
      saveManualReplay: async () => {
        const clip = await window.electron.replayClips.saveManualReplay();
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

        const refreshed = await refreshReplayClipState({ deletedIds: [id] });
        set((state) => {
          state.replayClips.error =
            result.cleanupError ?? (refreshed ? null : state.replayClips.error);
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
        const refreshed = await refreshReplayClipState({
          clearSelection: true,
          deletedIds: result.deletedIds,
        });
        set((state) => {
          state.replayClips.error =
            result.cleanupErrors?.[0]?.error ??
            (result.ok
              ? refreshed
                ? null
                : state.replayClips.error
              : result.error);
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
      startListening: () => {
        const stopStatusListener = window.electron.replayClips.onStatusChanged(
          (clip) => {
            patchReplayClipState(clip);
          },
        );
        const stopDeletedListener = window.electron.replayClips.onDeleted(
          (deletedIds) => {
            void refreshReplayClipState({ deletedIds });
          },
        );

        return () => {
          stopStatusListener();
          stopDeletedListener();
        };
      },
    },
  };
};
