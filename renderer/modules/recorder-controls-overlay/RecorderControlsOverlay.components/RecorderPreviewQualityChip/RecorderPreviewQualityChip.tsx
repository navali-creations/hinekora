import {
  useManagedRecorderShallow,
  useSettingsSelector,
} from "~/renderer/store";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

function RecorderPreviewQualityChip() {
  const captureMode = useManagedRecorderShallow(
    (managedRecorder) => managedRecorder.captureMode,
  );
  const previewResolution = useSettingsSelector(
    (settings) => settings.value?.replayClipPreviewResolution ?? "720p",
  );

  if (captureMode !== "rewind") {
    return null;
  }

  return (
    <span
      aria-label={`Rewind preview quality: ${previewResolution}`}
      className={`${styles.previewQualityChip} inline-flex h-6 min-w-11 shrink-0 items-center justify-center px-2 font-semibold text-[0.625rem] leading-none`}
      title={`Rewind preview quality: ${previewResolution}`}
    >
      {previewResolution}
    </span>
  );
}

export { RecorderPreviewQualityChip };
