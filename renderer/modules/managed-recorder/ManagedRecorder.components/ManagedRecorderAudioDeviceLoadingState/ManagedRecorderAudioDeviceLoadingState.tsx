import { FiRefreshCw } from "react-icons/fi";

function ManagedRecorderAudioDeviceLoadingState() {
  return (
    <div
      aria-label="Loading audio devices"
      className="flex min-h-20 items-center justify-center gap-2 rounded-md border border-base-content/10 bg-base-200/50 text-base-content/70 text-xs"
      role="status"
    >
      <FiRefreshCw className="h-4 w-4 animate-spin text-primary" />
      <span>Loading audio devices</span>
    </div>
  );
}

export { ManagedRecorderAudioDeviceLoadingState };
