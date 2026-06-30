import { EditorAudioControls } from "../EditorAudioControls/EditorAudioControls";
import { EditorPlaybackControls } from "../EditorPlaybackControls/EditorPlaybackControls";
import { EditorTimelineTools } from "../EditorTimelineTools/EditorTimelineTools";
import { EditorTimelineZoomControls } from "../EditorTimelineZoomControls/EditorTimelineZoomControls";

function EditorTimelineControlsRow() {
  return (
    <div className="grid h-12 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center border-base-content/10 border-b px-3">
      <EditorTimelineTools />
      <div className="relative z-10">
        <EditorPlaybackControls />
      </div>
      <div className="relative z-10 flex items-center justify-self-end gap-2">
        <EditorAudioControls />
        <EditorTimelineZoomControls />
      </div>
    </div>
  );
}

export { EditorTimelineControlsRow };
