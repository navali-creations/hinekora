type EditorPlaybackVisualTimeListener = (seconds: number) => void;

const editorPlaybackVisualTimeListeners =
  new Set<EditorPlaybackVisualTimeListener>();

function publishEditorPlaybackVisualTime(seconds: number): void {
  for (const listener of editorPlaybackVisualTimeListeners) {
    listener(seconds);
  }
}

function subscribeEditorPlaybackVisualTime(
  listener: EditorPlaybackVisualTimeListener,
): () => void {
  editorPlaybackVisualTimeListeners.add(listener);

  return () => {
    editorPlaybackVisualTimeListeners.delete(listener);
  };
}

export { publishEditorPlaybackVisualTime, subscribeEditorPlaybackVisualTime };
