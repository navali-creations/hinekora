import styles from "../../ClipPreviewOverlay.page/ClipPreviewOverlayPage.module.css";
import { ClipPreviewInfoAlert } from "../ClipPreviewInfoAlert/ClipPreviewInfoAlert";
import { ClipPreviewMutedAudioAlert } from "../ClipPreviewMutedAudioAlert/ClipPreviewMutedAudioAlert";
import { ClipPreviewOverlayActionsBar } from "../ClipPreviewOverlayActionsBar/ClipPreviewOverlayActionsBar";
import { ClipPreviewOverlayHeader } from "../ClipPreviewOverlayHeader/ClipPreviewOverlayHeader";
import { ClipPreviewOverlaySaveMessage } from "../ClipPreviewOverlaySaveMessage/ClipPreviewOverlaySaveMessage";
import { ClipPreviewOverlayTrimRail } from "../ClipPreviewOverlayTrimRail/ClipPreviewOverlayTrimRail";
import { ClipPreviewOverlayVideo } from "../ClipPreviewOverlayVideo/ClipPreviewOverlayVideo";

function ClipPreviewOverlayContent() {
  return (
    <main className={styles.overlay}>
      <ClipPreviewOverlayHeader />
      <ClipPreviewOverlayVideo />
      <ClipPreviewOverlayTrimRail />
      <ClipPreviewOverlayActionsBar />
      <ClipPreviewMutedAudioAlert />
      <ClipPreviewInfoAlert />
      <ClipPreviewOverlaySaveMessage />
    </main>
  );
}

export { ClipPreviewOverlayContent };
