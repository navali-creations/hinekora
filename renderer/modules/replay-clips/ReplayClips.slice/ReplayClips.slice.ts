import type { ReplayClipLibraryQuery } from "~/main/modules/replay-clips/ReplayClips.dto";
import { trackEvent } from "~/renderer/modules/umami";
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

const MAX_RECENT_REPLAY_CLIPS = 200;
const REPLAY_CLIP_LIBRARY_REFRESH_DELAY_MS = 200;

function getReplayClipSortValue(
  clip: ReplayClip,
  sortBy: ReplayClipLibraryQuery["sortBy"] = "createdAt",
): number | string {
  switch (sortBy) {
    case "name":
      return clip.processedClipPath ?? clip.originalObsPath ?? "";
    case "sourceLeague":
      return clip.sourceLeague;
    case "targetDurationSeconds":
      return clip.targetDurationSeconds;
    case "sizeBytes":
      return clip.sizeBytes;
    default:
      return clip.createdAt;
  }
}

function compareReplayClips(
  left: ReplayClip,
  right: ReplayClip,
  query: ReplayClipLibraryQuery,
): number {
  const sortDirection = query.sortDirection ?? "desc";
  const leftValue = getReplayClipSortValue(left, query.sortBy);
  const rightValue = getReplayClipSortValue(right, query.sortBy);
  const sortMultiplier = sortDirection === "asc" ? 1 : -1;

  if (typeof leftValue === "number" && typeof rightValue === "number") {
    const result = leftValue - rightValue;
    if (result !== 0) {
      return result * sortMultiplier;
    }
  } else {
    const result = String(leftValue).localeCompare(String(rightValue));
    if (result !== 0) {
      return result * sortMultiplier;
    }
  }

  return right.createdAt.localeCompare(left.createdAt);
}

function upsertReplayClip(
  items: ReplayClip[],
  clip: ReplayClip,
  query?: ReplayClipLibraryQuery,
): ReplayClip[] {
  const nextItems = [...items];
  const index = nextItems.findIndex((item) => item.id === clip.id);
  if (index >= 0) {
    nextItems[index] = clip;
  } else {
    nextItems.push(clip);
  }

  if (query) {
    nextItems.sort((left, right) => compareReplayClips(left, right, query));
    return nextItems;
  }

  nextItems.sort((left, right) =>
    right.createdAt.localeCompare(left.createdAt),
  );
  return nextItems.slice(0, MAX_RECENT_REPLAY_CLIPS);
}

function replayClipMatchesLibraryQuery(
  clip: ReplayClip,
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

  const scheduleLibraryRefresh = () => {
    if (libraryRefreshTimer !== null) {
      window.clearTimeout(libraryRefreshTimer);
    }

    libraryRefreshTimer = window.setTimeout(() => {
      libraryRefreshTimer = null;
      void get().replayClips.refreshLibrary();
    }, REPLAY_CLIP_LIBRARY_REFRESH_DELAY_MS);
  };

  const patchReplayClipState = (clip: ReplayClip) => {
    const query = get().replayClips.libraryQuery;
    let shouldRefreshLibrary = false;

    set((state) => {
      state.replayClips.activeClip = clip;
      state.replayClips.items = upsertReplayClip(state.replayClips.items, clip);
      state.replayClips.error = null;

      if (!query || !state.replayClips.libraryPage) {
        return;
      }

      const libraryIndex = state.replayClips.libraryItems.findIndex(
        (item) => item.id === clip.id,
      );
      const matchesLibrary = replayClipMatchesLibraryQuery(clip, query);
      if (libraryIndex >= 0 && matchesLibrary) {
        state.replayClips.libraryItems = upsertReplayClip(
          state.replayClips.libraryItems,
          clip,
          query,
        );
        return;
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
      saveManualReplay: async () => {
        const clip = await window.electron.replayClips.saveManualReplay();
        await refreshReplayClipState({
          activeClip: clip ?? get().replayClips.activeClip,
        });
        trackEvent("clip-manual-save-requested");
      },
      openClip: async (id: string) => {
        await window.electron.replayClips.open(id);
        trackEvent("clip-opened");
      },
      revealClip: async (id: string) => {
        await window.electron.replayClips.reveal(id);
        trackEvent("clip-revealed");
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
        trackEvent("clip-deleted");
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
        trackEvent("clips-deleted");
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
          patchReplayClipState(clip);
        }),
    },
  };
};
