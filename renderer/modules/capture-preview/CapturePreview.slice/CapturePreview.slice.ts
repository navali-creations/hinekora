import type { PoeProcessState } from "~/main/modules/poe-process/PoeProcess.dto";
import {
  createCapturePreviewSourcesWithGameFallback,
  isCapturePreviewSourceAvailable,
  resolveCapturePreviewSourceId,
} from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import { resolveActiveGameCaptureProfile } from "~/renderer/modules/capture-profiles/CaptureProfiles.utils/CaptureProfiles.utils";
import { trackEvent } from "~/renderer/modules/umami";
import type {
  BoundStoreStateCreator,
  CapturePreviewSlice,
} from "~/renderer/store/store.types";

import type { CapturePreviewSource, GameId } from "~/types";

const MAX_CAPTURE_PREVIEW_THUMBNAILS = 16;
const CAPTURE_SOURCE_REFRESH_RETRY_DELAY_MS = 2_500;
const CAPTURE_SOURCE_REFRESH_MAX_RETRIES = 8;

function pruneCapturePreviewThumbnails(
  thumbnailsBySourceId: Record<string, string | null | undefined>,
  sourceIds?: Set<string>,
): void {
  if (sourceIds) {
    for (const sourceId of Object.keys(thumbnailsBySourceId)) {
      if (!sourceIds.has(sourceId)) {
        delete thumbnailsBySourceId[sourceId];
      }
    }
  }

  const thumbnailSourceIds = Object.keys(thumbnailsBySourceId);
  const excessCount =
    thumbnailSourceIds.length - MAX_CAPTURE_PREVIEW_THUMBNAILS;
  if (excessCount <= 0) {
    return;
  }

  for (const sourceId of thumbnailSourceIds.slice(0, excessCount)) {
    delete thumbnailsBySourceId[sourceId];
  }
}

function shouldRetryCaptureSourceRefresh(
  poeProcessState: PoeProcessState | null,
  sources: CapturePreviewSource[],
): boolean {
  if (!poeProcessState?.isRunning || !poeProcessState.game) {
    return false;
  }

  const runningGame = poeProcessState.game;

  return !sources.some((source) => isCaptureSourceForGame(source, runningGame));
}

function isCaptureSourceForGame(
  source: CapturePreviewSource,
  game: GameId,
): boolean {
  if (source.kind !== "window") {
    return false;
  }

  return source.game === game && isCapturePreviewSourceAvailable(source);
}

export const createCapturePreviewSlice: BoundStoreStateCreator<
  CapturePreviewSlice
> = (set, get) => ({
  capturePreview: {
    sources: [],
    thumbnailsBySourceId: {},
    selectedSourceId: null,
    isLoading: false,
    error: null,
    hydrate: async () => {
      await get().capturePreview.refresh();
    },
    startListening: () => {
      let retryTimer: number | null = null;
      let requestVersion = 0;
      const clearRetryTimer = () => {
        if (retryTimer === null) {
          return;
        }

        window.clearTimeout(retryTimer);
        retryTimer = null;
      };
      const scheduleRetry = (version: number, retriesRemaining: number) => {
        if (retriesRemaining <= 0) {
          return;
        }

        retryTimer = window.setTimeout(() => {
          retryTimer = null;
          const nextStore = get();
          if (
            version !== requestVersion ||
            !shouldRetryCaptureSourceRefresh(
              nextStore.poeProcess.state,
              nextStore.capturePreview.sources,
            )
          ) {
            return;
          }

          void get()
            .capturePreview.refresh({ force: true })
            .then(() => {
              if (version !== requestVersion) {
                return;
              }

              const refreshedStore = get();
              if (
                shouldRetryCaptureSourceRefresh(
                  refreshedStore.poeProcess.state,
                  refreshedStore.capturePreview.sources,
                )
              ) {
                scheduleRetry(version, retriesRemaining - 1);
              }
            });
        }, CAPTURE_SOURCE_REFRESH_RETRY_DELAY_MS);
      };
      const refreshAfterRequest = async (version: number) => {
        await get().capturePreview.refresh({ force: true });
        if (version !== requestVersion) {
          return;
        }

        const store = get();
        if (
          !shouldRetryCaptureSourceRefresh(
            store.poeProcess.state,
            store.capturePreview.sources,
          )
        ) {
          return;
        }

        scheduleRetry(version, CAPTURE_SOURCE_REFRESH_MAX_RETRIES);
      };
      const unsubscribe = window.electron.capturePreview.onRefreshRequested(
        () => {
          requestVersion += 1;
          clearRetryTimer();
          void refreshAfterRequest(requestVersion);
        },
      );

      return () => {
        requestVersion += 1;
        clearRetryTimer();
        unsubscribe();
      };
    },
    refresh: async (options = {}) => {
      set((state) => {
        state.capturePreview.isLoading = true;
        state.capturePreview.error = null;
      });

      try {
        const liveSources = await window.electron.capturePreview.listSources(
          options.force === true,
        );
        const profiles = get().captureProfiles;
        const activeGame = get().settings.value?.activeGame ?? "poe1";
        const sources =
          createCapturePreviewSourcesWithGameFallback(liveSources);
        const selectedProfile = resolveActiveGameCaptureProfile(
          profiles.items,
          profiles.selectedProfileId,
          activeGame,
        );
        const selectedSourceId = resolveCapturePreviewSourceId(
          selectedProfile?.captureTarget ?? null,
          sources,
          get().capturePreview.selectedSourceId,
          activeGame,
        );

        set((state) => {
          state.capturePreview.sources = sources;
          state.capturePreview.selectedSourceId = selectedSourceId;
          if (options.force === true) {
            state.capturePreview.thumbnailsBySourceId = {};
          } else {
            pruneCapturePreviewThumbnails(
              state.capturePreview.thumbnailsBySourceId,
              new Set(sources.map((source) => source.id)),
            );
          }
          state.capturePreview.isLoading = false;
          state.capturePreview.error = null;
        });
        if (options.force === true) {
          trackEvent("capture-sources-refreshed", {
            count: sources.length,
          });
        }
      } catch (error) {
        set((state) => {
          state.capturePreview.isLoading = false;
          state.capturePreview.error =
            error instanceof Error
              ? error.message
              : "Unable to list capture sources";
        });
      }
    },
    getThumbnail: async (sourceId) => {
      const cached = get().capturePreview.thumbnailsBySourceId[sourceId];
      if (cached !== undefined) {
        return cached;
      }

      const thumbnailDataUrl =
        await window.electron.capturePreview.getSourceThumbnail(sourceId);
      set((state) => {
        state.capturePreview.thumbnailsBySourceId[sourceId] = thumbnailDataUrl;
        pruneCapturePreviewThumbnails(
          state.capturePreview.thumbnailsBySourceId,
        );
      });

      return thumbnailDataUrl;
    },
    select: (id: string) => {
      set((state) => {
        state.capturePreview.selectedSourceId = id;
      });
      trackEvent("capture-source-selected");
    },
  },
});
