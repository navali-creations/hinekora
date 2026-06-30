import { FiAlertCircle } from "react-icons/fi";

function ManagedRecorderAudioDeviceErrorState() {
  return (
    <div
      className="flex min-h-20 items-center justify-center gap-2 rounded-md border border-error/25 bg-error/10 px-3 text-error text-xs"
      role="alert"
    >
      <FiAlertCircle className="h-4 w-4 shrink-0" />
      <span>Audio devices could not be loaded. Try refreshing.</span>
    </div>
  );
}

export { ManagedRecorderAudioDeviceErrorState };
