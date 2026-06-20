import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

interface CropEditorSlice {
  cropEditor: {
    auraOverlayLocked: boolean;
    selectedAuraCropRegionId: string | null;
    hydrate: () => Promise<void>;
    startListening: () => () => void;
    setAuraOverlayLocked: (locked: boolean) => void;
    selectAura: (cropRegionId: string | null) => void;
  };
}

export const createCropEditorSlice: BoundStoreStateCreator<CropEditorSlice> = (
  set,
) => ({
  cropEditor: {
    auraOverlayLocked: true,
    selectedAuraCropRegionId: null,
    hydrate: async () => {
      const auraOverlayLocked =
        await window.electron.overlayWindows.isAuraLocked();
      set((state) => {
        state.cropEditor.auraOverlayLocked = auraOverlayLocked;
      });
    },
    startListening: () =>
      window.electron.overlayWindows.onAuraLockChanged((auraOverlayLocked) => {
        set((state) => {
          state.cropEditor.auraOverlayLocked = auraOverlayLocked;
        });
      }),
    setAuraOverlayLocked: (auraOverlayLocked) => {
      set((state) => {
        state.cropEditor.auraOverlayLocked = auraOverlayLocked;
      });
    },
    selectAura: (selectedAuraCropRegionId) => {
      set((state) => {
        state.cropEditor.selectedAuraCropRegionId = selectedAuraCropRegionId;
      });
    },
  },
});

export type { CropEditorSlice };
