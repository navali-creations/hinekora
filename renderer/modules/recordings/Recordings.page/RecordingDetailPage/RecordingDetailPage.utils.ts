type RecordingPlaybackVisualTimeListener = (seconds: number) => void;

const recordingPlaybackVisualTimeListeners =
  new Set<RecordingPlaybackVisualTimeListener>();

function publishRecordingPlaybackVisualTime(seconds: number): void {
  for (const listener of recordingPlaybackVisualTimeListeners) {
    listener(seconds);
  }
}

function subscribeRecordingPlaybackVisualTime(
  listener: RecordingPlaybackVisualTimeListener,
): () => void {
  recordingPlaybackVisualTimeListeners.add(listener);

  return () => {
    recordingPlaybackVisualTimeListeners.delete(listener);
  };
}

export {
  publishRecordingPlaybackVisualTime,
  subscribeRecordingPlaybackVisualTime,
};
