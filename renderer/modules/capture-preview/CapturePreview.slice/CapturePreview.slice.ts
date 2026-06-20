import { resolveCapturePreviewSourceId } from "~/renderer/modules/capture-preview/CapturePreview.utils/CapturePreview.utils";
import type {
  BoundStoreStateCreator,
  CapturePreviewSlice,
} from "~/renderer/store/store.types";

export const createCapturePreviewSlice: BoundStoreStateCreator<
  CapturePreviewSlice
> = (set, get) => ({
  capturePreview: {
    sources: [],
    selectedSourceId: null,
    isLoading: false,
    error: null,
    hydrate: async () => {
      await get().capturePreview.refresh();
    },
    refresh: async (options = {}) => {
      set((state) => {
        state.capturePreview.isLoading = true;
        state.capturePreview.error = null;
      });

      try {
        const sources = await window.electron.capturePreview.listSources(
          options.force === true,
        );
        const profiles = get().profiles;
        const selectedProfile =
          profiles.items.find(
            (profile) => profile.id === profiles.selectedProfileId,
          ) ?? null;
        const selectedSourceId = resolveCapturePreviewSourceId(
          selectedProfile?.captureTarget ?? null,
          sources,
          get().capturePreview.selectedSourceId,
        );

        set((state) => {
          state.capturePreview.sources = sources;
          state.capturePreview.selectedSourceId = selectedSourceId;
          state.capturePreview.isLoading = false;
          state.capturePreview.error = null;
        });
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
    select: (id: string) => {
      set((state) => {
        state.capturePreview.selectedSourceId = id;
      });
    },
  },
});
