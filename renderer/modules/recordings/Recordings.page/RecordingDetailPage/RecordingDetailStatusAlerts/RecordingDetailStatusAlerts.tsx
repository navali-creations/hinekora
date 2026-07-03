import clsx from "clsx";

import type { FileActionMessage } from "../useRecordingDetailFileActions/useRecordingDetailFileActions";

interface RecordingDetailStatusAlertsProps {
  error: string | null;
  fileActionMessage: FileActionMessage | null;
  hasDetail: boolean;
  isLoading: boolean;
}

function RecordingDetailStatusAlerts({
  error,
  fileActionMessage,
  hasDetail,
  isLoading,
}: RecordingDetailStatusAlertsProps) {
  return (
    <>
      {fileActionMessage && (
        <div
          className={clsx("alert text-sm", {
            "alert-error": fileActionMessage.tone === "error",
            "alert-success": fileActionMessage.tone === "success",
          })}
          role="alert"
        >
          {fileActionMessage.text}
        </div>
      )}

      {isLoading && (
        <div className="flex items-center gap-3 text-base-content/60">
          <span className="loading loading-spinner loading-sm" />
          <span className="text-sm">Loading recording...</span>
        </div>
      )}

      {error && (
        <div className="alert alert-error text-sm" role="alert">
          {error}
        </div>
      )}

      {!isLoading && !error && !hasDetail && (
        <div className="alert alert-warning text-sm" role="alert">
          Recording was not found.
        </div>
      )}
    </>
  );
}

export { RecordingDetailStatusAlerts };
