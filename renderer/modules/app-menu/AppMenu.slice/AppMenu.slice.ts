import type { LatestReleaseInfo } from "~/main/modules/updater/Updater.api";
import { trackEvent } from "~/renderer/modules/umami";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

import {
  getWhatsNewReleasesForView,
  selectInitialWhatsNewRelease,
} from "../AppMenu.utils/AppMenu.utils";

export interface AppMenuSlice {
  appMenu: {
    isMaximized: boolean;
    isRecorderOverlayRequested: boolean;
    isRecorderOverlayVisible: boolean;
    isWhatsNewOpen: boolean;
    whatsNewRelease: LatestReleaseInfo | null;
    whatsNewReleases: LatestReleaseInfo[];
    whatsNewSelectedVersion: string | null;
    whatsNewIsLoading: boolean;
    whatsNewError: string | null;
    whatsNewHasFetched: boolean;
    whatsNewFromVersion: string | null;
    whatsNewCurrentVersion: string | null;
    hydrate: () => Promise<void>;
    minimize: () => void;
    maximize: () => Promise<void>;
    unmaximize: () => Promise<void>;
    close: () => void;
    setIsMaximized: (isMaximized: boolean) => void;
    toggleRecorderOverlay: () => Promise<void>;
    setRecorderOverlayVisible: (isVisible: boolean) => void;
    openWhatsNew: () => Promise<void>;
    closeWhatsNew: () => void;
    selectWhatsNewRelease: (version: string) => void;
    startListening: () => () => void;
  };
}

type AppMenuStateUpdate = Partial<
  Omit<
    AppMenuSlice["appMenu"],
    | "hydrate"
    | "minimize"
    | "maximize"
    | "unmaximize"
    | "close"
    | "setIsMaximized"
    | "toggleRecorderOverlay"
    | "setRecorderOverlayVisible"
    | "openWhatsNew"
    | "closeWhatsNew"
    | "selectWhatsNewRelease"
    | "startListening"
  >
>;

async function persistLastSeenAppVersion(version: string): Promise<void> {
  await window.electron.settings.update?.({ lastSeenAppVersion: version });
}

export const createAppMenuSlice: BoundStoreStateCreator<AppMenuSlice> = (
  set,
  get,
) => {
  const setAppMenu = (update: AppMenuStateUpdate, action: string) => {
    set(
      ({ appMenu }) => {
        Object.assign(appMenu, update);
      },
      false,
      action,
    );
  };

  return {
    appMenu: {
      isMaximized: false,
      isRecorderOverlayRequested: false,
      isRecorderOverlayVisible: false,
      isWhatsNewOpen: false,
      whatsNewRelease: null,
      whatsNewReleases: [],
      whatsNewSelectedVersion: null,
      whatsNewIsLoading: false,
      whatsNewError: null,
      whatsNewHasFetched: false,
      whatsNewFromVersion: null,
      whatsNewCurrentVersion: null,

      hydrate: async () => {
        try {
          const isMaximized = await window.electron.mainWindow.isMaximized();
          setAppMenu({ isMaximized }, "appMenuSlice/hydrate");
        } catch (_error) {
          setAppMenu({ isMaximized: false }, "appMenuSlice/hydrateError");
        }

        try {
          const [isRecorderOverlayVisible, isRecorderOverlayRequested] =
            await Promise.all([
              window.electron.overlayWindows.isRecorderVisible(),
              window.electron.overlayWindows.isRecorderRequested(),
            ]);
          setAppMenu(
            { isRecorderOverlayRequested, isRecorderOverlayVisible },
            "appMenuSlice/hydrate/recorderOverlay",
          );
        } catch (_error) {
          setAppMenu(
            {
              isRecorderOverlayRequested: false,
              isRecorderOverlayVisible: false,
            },
            "appMenuSlice/hydrate/recorderOverlayError",
          );
        }

        try {
          const currentVersion = await window.electron.app.getVersion();
          const settings = await window.electron.settings.get();
          const lastSeenVersion =
            "lastSeenAppVersion" in settings
              ? settings.lastSeenAppVersion
              : null;

          if (lastSeenVersion && lastSeenVersion !== currentVersion) {
            setAppMenu(
              {
                whatsNewFromVersion: lastSeenVersion,
                whatsNewCurrentVersion: currentVersion,
              },
              "appMenuSlice/hydrate/whatsNewVersions",
            );

            setTimeout(() => {
              void get().appMenu.openWhatsNew();
            }, 3000);

            return;
          }

          await persistLastSeenAppVersion(currentVersion);
        } catch (_error) {
          // Version prompts are non-critical.
        }
      },

      minimize: () => {
        trackEvent("window-minimized");
        void window.electron.mainWindow.minimize();
      },

      maximize: async () => {
        await window.electron.mainWindow.maximize();
        const isMaximized = await window.electron.mainWindow.isMaximized();
        setAppMenu({ isMaximized }, "appMenuSlice/maximize");
        trackEvent("window-maximized");
      },

      unmaximize: async () => {
        await window.electron.mainWindow.unmaximize();
        const isMaximized = await window.electron.mainWindow.isMaximized();
        setAppMenu({ isMaximized }, "appMenuSlice/unmaximize");
        trackEvent("window-restored");
      },

      close: () => {
        trackEvent("window-closed");
        void window.electron.mainWindow.close();
      },

      setIsMaximized: (isMaximized) => {
        setAppMenu({ isMaximized }, "appMenuSlice/setIsMaximized");
      },

      toggleRecorderOverlay: async () => {
        await window.electron.overlayWindows.toggleRecorder();
        const [isRecorderOverlayVisible, isRecorderOverlayRequested] =
          await Promise.all([
            window.electron.overlayWindows.isRecorderVisible(),
            window.electron.overlayWindows.isRecorderRequested(),
          ]);
        setAppMenu(
          { isRecorderOverlayRequested, isRecorderOverlayVisible },
          "appMenuSlice/toggleRecorderOverlay",
        );
        trackEvent("recorder-overlay-toggled", {
          visible: isRecorderOverlayVisible,
        });
      },

      setRecorderOverlayVisible: (isRecorderOverlayVisible) => {
        setAppMenu(
          { isRecorderOverlayVisible },
          "appMenuSlice/setRecorderOverlayVisible",
        );
      },

      openWhatsNew: async () => {
        setAppMenu({ isWhatsNewOpen: true }, "appMenuSlice/openWhatsNew");
        trackEvent("whats-new-opened");

        const existing = get().appMenu;
        if (
          existing.whatsNewHasFetched &&
          existing.whatsNewRelease &&
          existing.whatsNewReleases.length > 0
        ) {
          return;
        }

        setAppMenu(
          {
            whatsNewIsLoading: true,
            whatsNewError: null,
          },
          "appMenuSlice/openWhatsNew/fetchStart",
        );

        try {
          const recentReleases =
            await window.electron.updater.getRecentReleases();
          const { whatsNewFromVersion, whatsNewCurrentVersion } = get().appMenu;
          const releases = getWhatsNewReleasesForView(
            recentReleases,
            whatsNewFromVersion,
            whatsNewCurrentVersion,
          );
          const selectedRelease = selectInitialWhatsNewRelease(
            releases,
            Boolean(whatsNewFromVersion),
          );

          if (!selectedRelease) {
            setAppMenu(
              {
                whatsNewError: "Could not fetch release information.",
                whatsNewReleases: [],
                whatsNewSelectedVersion: null,
                whatsNewIsLoading: false,
                whatsNewHasFetched: true,
              },
              "appMenuSlice/openWhatsNew/fetchEmpty",
            );
            return;
          }

          setAppMenu(
            {
              whatsNewRelease: selectedRelease,
              whatsNewReleases: releases,
              whatsNewSelectedVersion: selectedRelease.version,
              whatsNewIsLoading: false,
              whatsNewHasFetched: true,
            },
            "appMenuSlice/openWhatsNew/fetchSuccess",
          );
        } catch (error) {
          setAppMenu(
            {
              whatsNewError:
                error instanceof Error
                  ? error.message
                  : "Could not fetch release information.",
              whatsNewReleases: [],
              whatsNewSelectedVersion: null,
              whatsNewIsLoading: false,
              whatsNewHasFetched: true,
            },
            "appMenuSlice/openWhatsNew/fetchError",
          );
        }
      },

      closeWhatsNew: () => {
        const { whatsNewCurrentVersion, whatsNewReleases } = get().appMenu;
        const versionToMarkSeen =
          whatsNewCurrentVersion && whatsNewReleases.length > 0
            ? whatsNewCurrentVersion
            : null;
        const latestRelease = whatsNewReleases.at(-1) ?? null;

        setAppMenu(
          {
            whatsNewRelease: latestRelease,
            whatsNewSelectedVersion: latestRelease?.version ?? null,
            whatsNewFromVersion: null,
            whatsNewCurrentVersion: null,
            isWhatsNewOpen: false,
          },
          "appMenuSlice/closeWhatsNew",
        );
        trackEvent("whats-new-closed", {
          markedVersionSeen: Boolean(versionToMarkSeen),
        });

        if (versionToMarkSeen) {
          void persistLastSeenAppVersion(versionToMarkSeen).catch(
            () => undefined,
          );
        }
      },

      selectWhatsNewRelease: (version) => {
        const release =
          get().appMenu.whatsNewReleases.find(
            (candidate) => candidate.version === version,
          ) ?? null;

        if (!release) {
          return;
        }

        setAppMenu(
          {
            whatsNewRelease: release,
            whatsNewSelectedVersion: release.version,
          },
          "appMenuSlice/selectWhatsNewRelease",
        );
        trackEvent("whats-new-release-selected");
      },

      startListening: () =>
        window.electron.overlayWindows.onRecorderVisibilityChanged(
          (isRecorderOverlayVisible) => {
            void window.electron.overlayWindows
              .isRecorderRequested()
              .then((isRecorderOverlayRequested) => {
                setAppMenu(
                  { isRecorderOverlayRequested },
                  "appMenuSlice/recorderOverlayRequestedChanged",
                );
              })
              .catch(() => {
                setAppMenu(
                  { isRecorderOverlayRequested: false },
                  "appMenuSlice/recorderOverlayRequestedError",
                );
              });
            setAppMenu(
              { isRecorderOverlayVisible },
              "appMenuSlice/recorderOverlayVisibilityChanged",
            );
          },
        ),
    },
  };
};
