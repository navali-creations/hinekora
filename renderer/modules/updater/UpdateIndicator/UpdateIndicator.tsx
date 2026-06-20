import { FiDownload, FiExternalLink, FiRefreshCw } from "react-icons/fi";

import { useUpdater } from "~/renderer/store";

const buttonClass = "no-drag btn btn-ghost btn-sm";
const APPBAR_ICON_SIZE = 16;

function UpdateIndicator() {
  const {
    updateAvailable,
    updateInfo,
    isDismissed,
    status,
    downloadProgress,
    error,
    downloadAndInstall,
  } = useUpdater();

  const handleDownloadAndInstall = () => {
    void downloadAndInstall();
  };

  if (!updateAvailable || isDismissed || !updateInfo) {
    return null;
  }

  const isManual = updateInfo.manualDownload;
  const Icon = isManual ? FiExternalLink : FiDownload;

  if (status === "downloading") {
    const isIndeterminate = downloadProgress.percent < 0;
    const label = isIndeterminate
      ? "Updating..."
      : `${Math.round(downloadProgress.percent)}%`;

    return (
      <div className="flex items-center gap-1.5 px-2">
        <div className="flex min-w-25 items-center gap-1.5">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-base-300">
            {isIndeterminate ? (
              <div className="h-1.5 w-1/3 animate-[indeterminate_1.5s_ease-in-out_infinite] rounded-full bg-success" />
            ) : (
              <div
                className="h-1.5 rounded-full bg-success transition-all duration-300"
                style={{ width: `${downloadProgress.percent}%` }}
              />
            )}
          </div>
          <span className="whitespace-nowrap text-success text-xs">
            {label}
          </span>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div
        className="tooltip tooltip-open tooltip-bottom tooltip-error"
        data-tip={error ?? "Update failed"}
      >
        <button
          type="button"
          className={`${buttonClass} text-error`}
          title="Retry update"
          onClick={handleDownloadAndInstall}
        >
          <FiRefreshCw size={APPBAR_ICON_SIZE} />
        </button>
      </div>
    );
  }

  const tooltip =
    status === "ready" && !isManual ? "Restart to update" : "View release";
  const title = isManual
    ? `View Hinekora v${updateInfo.latestVersion} on GitHub`
    : status === "ready"
      ? `Restart to apply Hinekora v${updateInfo.latestVersion}`
      : `Update to Hinekora v${updateInfo.latestVersion}`;

  return (
    <div
      className="tooltip tooltip-open tooltip-bottom tooltip-success"
      data-tip={tooltip}
    >
      <button
        type="button"
        className={`${buttonClass} animate-pulse text-success`}
        title={title}
        onClick={handleDownloadAndInstall}
      >
        <Icon size={APPBAR_ICON_SIZE} />
      </button>
    </div>
  );
}

export default UpdateIndicator;
