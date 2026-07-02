import clsx from "clsx";
import { FiLock as Lock, FiUnlock as Unlock } from "react-icons/fi";

import {
  useCaptureProfilesShallow,
  useManagedRecorderShallow,
} from "~/renderer/store";

interface CaptureProfileLockToggleProps {
  attached?: boolean;
  size?: "sm" | "xs";
  variant?: "chip" | "icon";
}

function CaptureProfileLockToggle({
  attached = false,
  size = "sm",
  variant = "icon",
}: CaptureProfileLockToggleProps) {
  const { isProfileUnlocked, selectedProfileId, toggleProfileLock } =
    useCaptureProfilesShallow((captureProfiles) => ({
      isProfileUnlocked: captureProfiles.isProfileUnlocked,
      selectedProfileId: captureProfiles.selectedProfileId,
      toggleProfileLock: captureProfiles.toggleProfileLock,
    }));
  const isRecorderActive = useManagedRecorderShallow(
    (managedRecorder) =>
      managedRecorder.status?.bufferActive === true ||
      managedRecorder.status?.runRecordingActive === true ||
      managedRecorder.status?.isStartingRecording === true ||
      managedRecorder.status?.isStoppingRecording === true,
  );
  const Icon = isProfileUnlocked ? Unlock : Lock;
  const label = isProfileUnlocked ? "Unlocked" : "Locked";
  const ariaLabel = isProfileUnlocked
    ? "Lock capture profile"
    : "Unlock capture profile";
  const isUnlockBlocked = !isProfileUnlocked && isRecorderActive;
  const isDisabled = selectedProfileId === null || isUnlockBlocked;
  let title = ariaLabel;

  if (selectedProfileId === null) {
    title = "Select a capture profile first";
  } else if (isUnlockBlocked) {
    title = "Stop recording or rewind before unlocking the profile";
  }

  if (variant === "chip") {
    return (
      <button
        aria-label={ariaLabel}
        className={clsx(
          "badge rounded-full border font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-45",
          size === "xs"
            ? "badge-xs h-5 gap-1 px-2 text-[0.6875rem]"
            : "h-7 gap-1.5 px-2.5 text-[0.75rem]",
          isProfileUnlocked
            ? "border-primary bg-primary text-primary-content"
            : "border-base-content/20 bg-base-200 text-base-content/75 hover:border-primary hover:text-primary",
        )}
        disabled={isDisabled}
        title={title}
        type="button"
        onClick={toggleProfileLock}
      >
        <Icon size={size === "xs" ? 11 : 13} />
        {label}
      </button>
    );
  }

  return (
    <button
      aria-label={ariaLabel}
      className={clsx(
        "btn btn-square btn-sm border-base-content/15 bg-base-200 text-base-content/70 hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-45",
        isProfileUnlocked && "border-primary bg-primary text-primary-content",
        attached && "join-item rounded-l-none",
      )}
      disabled={isDisabled}
      title={title}
      type="button"
      onClick={toggleProfileLock}
    >
      <Icon size={15} />
    </button>
  );
}

export { CaptureProfileLockToggle };
