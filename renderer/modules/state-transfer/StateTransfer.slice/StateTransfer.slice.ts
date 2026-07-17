import type {
  BoundStoreStateCreator,
  StateTransferSlice,
} from "~/renderer/store/store.types";

export const createStateTransferSlice: BoundStoreStateCreator<
  StateTransferSlice
> = (set, get) => ({
  stateTransfer: {
    preview: null,
    lastMessage: null,
    exportPortable: async () => {
      const result = await window.electron.stateTransfer.exportPortable();
      set((state) => {
        state.stateTransfer.lastMessage = result.ok
          ? `Exported to ${result.path}`
          : (result.error ?? "Export canceled");
      });
    },
    previewImport: async () => {
      const preview = await window.electron.stateTransfer.previewImport();
      set((state) => {
        state.stateTransfer.preview = preview;
        state.stateTransfer.lastMessage = preview
          ? "Import ready to apply"
          : "Import canceled";
      });
    },
    importPortable: async (mode) => {
      const result = await window.electron.stateTransfer.importPortable(mode);
      if (result.ok) {
        const replayLibraryRefresh = get().replayClips.libraryQuery
          ? get().replayClips.refreshLibrary()
          : Promise.resolve();
        await Promise.all([
          get().settings.hydrate(),
          get().profiles.hydrate(),
          get().captureProfiles.hydrate(),
          get().recordingStorage.refreshUsage(),
          replayLibraryRefresh,
        ]);
      }
      set((state) => {
        if (result.ok) {
          state.stateTransfer.preview = null;
        }
        state.stateTransfer.lastMessage = result.ok
          ? "Import applied"
          : (result.error ?? "Import failed");
      });
    },
  },
});
