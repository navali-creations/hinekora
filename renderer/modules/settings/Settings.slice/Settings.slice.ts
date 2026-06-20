import type {
  BoundStoreStateCreator,
  SettingsSlice,
} from "~/renderer/store/store.types";

import type { AppSettings } from "~/types";

export const createSettingsSlice: BoundStoreStateCreator<SettingsSlice> = (
  set,
) => ({
  settings: {
    value: null,
    hydrate: async () => {
      const value = await window.electron.settings.get();
      set((state) => {
        state.settings.value = value;
      });
    },
    update: async (input: Partial<AppSettings>) => {
      const value = await window.electron.settings.update(input);
      set((state) => {
        state.settings.value = value;
      });
    },
  },
});
