import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

export interface ChangelogSlice {
  changelog: {
    releases: ChangelogRelease[];
    isLoading: boolean;
    error: string | null;
    hasFetched: boolean;
    fetchChangelog: () => Promise<void>;
    reset: () => void;
  };
}

export const createChangelogSlice: BoundStoreStateCreator<ChangelogSlice> = (
  set,
  get,
) => ({
  changelog: {
    releases: [],
    isLoading: false,
    error: null,
    hasFetched: false,

    fetchChangelog: async () => {
      if (get().changelog.hasFetched && get().changelog.releases.length > 0) {
        return;
      }

      set(
        ({ changelog }) => {
          changelog.isLoading = true;
          changelog.error = null;
        },
        false,
        "changelogSlice/fetchChangelog/start",
      );

      try {
        const result = await window.electron.updater.getChangelog();

        if (result.success) {
          set(
            ({ changelog }) => {
              changelog.releases = result.releases;
              changelog.isLoading = false;
              changelog.hasFetched = true;
            },
            false,
            "changelogSlice/fetchChangelog/success",
          );
          return;
        }

        set(
          ({ changelog }) => {
            changelog.error = result.error ?? "Failed to load changelog";
            changelog.isLoading = false;
            changelog.hasFetched = true;
          },
          false,
          "changelogSlice/fetchChangelog/error",
        );
      } catch (error) {
        set(
          ({ changelog }) => {
            changelog.error =
              error instanceof Error ? error.message : "Load failed";
            changelog.isLoading = false;
            changelog.hasFetched = true;
          },
          false,
          "changelogSlice/fetchChangelog/error",
        );
      }
    },

    reset: () => {
      set(
        ({ changelog }) => {
          changelog.releases = [];
          changelog.isLoading = false;
          changelog.error = null;
          changelog.hasFetched = false;
        },
        false,
        "changelogSlice/reset",
      );
    },
  },
});
