import type {
  DownloadProgress,
  UpdateInfo,
  UpdateStatus,
} from "~/main/modules/updater/Updater.service";
import type { BoundStoreStateCreator } from "~/renderer/store/store.types";

export interface UpdaterSlice {
  updater: {
    updateInfo: UpdateInfo | null;
    updateAvailable: boolean;
    isDismissed: boolean;
    status: UpdateStatus;
    downloadProgress: DownloadProgress;
    error: string | null;
    checkForUpdates: () => Promise<void>;
    downloadAndInstall: () => Promise<void>;
    dismiss: () => void;
    startListening: () => () => void;
  };
}

type UpdaterStateUpdate = Partial<
  Omit<
    UpdaterSlice["updater"],
    "checkForUpdates" | "downloadAndInstall" | "dismiss" | "startListening"
  >
>;

const initialDownloadProgress: DownloadProgress = {
  percent: 0,
  transferredBytes: 0,
  totalBytes: 0,
};

export const createUpdaterSlice: BoundStoreStateCreator<UpdaterSlice> = (
  set,
  get,
) => {
  const setUpdater = (update: UpdaterStateUpdate, action: string) => {
    set(
      ({ updater }) => {
        Object.assign(updater, update);
      },
      false,
      action,
    );
  };

  return {
    updater: {
      updateInfo: null,
      updateAvailable: false,
      isDismissed: false,
      status: "idle",
      downloadProgress: initialDownloadProgress,
      error: null,

      checkForUpdates: async () => {
        try {
          const info = await window.electron.updater.checkForUpdates();
          if (!info?.updateAvailable) {
            return;
          }

          setUpdater(
            {
              updateInfo: info,
              updateAvailable: true,
              isDismissed: false,
              status: "idle",
              error: null,
            },
            "updaterSlice/checkForUpdates",
          );
        } catch (error) {
          console.error("[Updater] Failed to check for updates:", error);
        }
      },

      downloadAndInstall: async () => {
        const { status } = get().updater;

        if (status === "ready") {
          setUpdater({ error: null }, "updaterSlice/installUpdate");

          const installResult = await window.electron.updater.installUpdate();
          if (!installResult.success) {
            setUpdater(
              {
                status: "error",
                error: installResult.error ?? "Install failed",
              },
              "updaterSlice/installUpdateError",
            );
          }
          return;
        }

        if (status === "downloading") {
          return;
        }

        setUpdater(
          {
            error: null,
            status: "idle",
          },
          "updaterSlice/retryCheck",
        );

        try {
          const info = await window.electron.updater.checkForUpdates();
          if (info?.updateAvailable) {
            setUpdater(
              {
                updateInfo: info,
                updateAvailable: true,
              },
              "updaterSlice/retryCheckResult",
            );
          }
        } catch (error) {
          console.error("[Updater] Retry check failed:", error);
          setUpdater(
            {
              status: "error",
              error: "Failed to check for updates",
            },
            "updaterSlice/retryCheckError",
          );
        }
      },

      dismiss: () => {
        setUpdater({ isDismissed: true }, "updaterSlice/dismiss");
      },

      startListening: () => {
        const cleanups = [
          window.electron.updater.onUpdateAvailable((info) => {
            setUpdater(
              {
                updateInfo: info,
                updateAvailable: true,
                isDismissed: false,
                status: "ready",
              },
              "updaterSlice/onUpdateAvailable",
            );
          }),
          window.electron.updater.onDownloadProgress((progress) => {
            setUpdater(
              {
                downloadProgress: progress,
                status: progress.percent < 100 ? "downloading" : "ready",
              },
              "updaterSlice/onDownloadProgress",
            );
          }),
        ];

        return () => {
          for (const cleanup of cleanups) {
            cleanup();
          }
        };
      },
    },
  };
};
