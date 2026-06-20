import type {
  BoundStoreStateCreator,
  ProfilesSlice,
} from "~/renderer/store/store.types";

import type { ProfileUpdateInput } from "~/types";

export const createProfilesSlice: BoundStoreStateCreator<ProfilesSlice> = (
  set,
) => ({
  profiles: {
    items: [],
    isLoading: false,
    error: null,
    selectedProfileId: null,
    hydrate: async () => {
      set((state) => {
        state.profiles.isLoading = true;
        state.profiles.error = null;
      });
      try {
        const items = await window.electron.profiles.list();
        set((state) => {
          state.profiles.items = items;
          state.profiles.isLoading = false;
          state.profiles.selectedProfileId =
            state.profiles.selectedProfileId &&
            items.some((item) => item.id === state.profiles.selectedProfileId)
              ? state.profiles.selectedProfileId
              : (items[0]?.id ?? null);
        });
      } catch (error) {
        set((state) => {
          state.profiles.isLoading = false;
          state.profiles.error =
            error instanceof Error ? error.message : "Load failed";
        });
      }
    },
    create: async (name: string) => {
      const created = await window.electron.profiles.create({
        name,
        game: "poe1",
      });
      const items = await window.electron.profiles.list();
      set((state) => {
        state.profiles.items = items;
        state.profiles.selectedProfileId = created.id;
      });
    },
    update: async (input: ProfileUpdateInput) => {
      const updated = await window.electron.profiles.update(input);
      const items = await window.electron.profiles.list();
      set((state) => {
        state.profiles.items = items;
        state.profiles.selectedProfileId = updated.id;
      });
    },
    select: (id: string) => {
      set((state) => {
        state.profiles.selectedProfileId = id;
      });
    },
    startListening: () =>
      window.electron.profiles.onChanged((items) => {
        set((state) => {
          state.profiles.items = items;
          state.profiles.selectedProfileId =
            state.profiles.selectedProfileId &&
            items.some((item) => item.id === state.profiles.selectedProfileId)
              ? state.profiles.selectedProfileId
              : (items[0]?.id ?? null);
        });
      }),
  },
});
