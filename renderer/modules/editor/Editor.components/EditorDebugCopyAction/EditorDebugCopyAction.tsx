import { FiCode } from "react-icons/fi";

import { useBoundStore } from "~/renderer/store";

function EditorDebugCopyAction() {
  const handleCopyDebugJson = () => {
    const editor = useBoundStore.getState().editor;
    const payload = JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        editor: {
          historyFuture: editor.historyFuture,
          historyFutureLabels: editor.historyFutureLabels,
          historyFutureSubtitles: editor.historyFutureSubtitles,
          historyPast: editor.historyPast,
          historyPastLabels: editor.historyPastLabels,
          historyPastSubtitles: editor.historyPastSubtitles,
          mediaAssetPage: editor.mediaAssetPage,
          mediaAssetPendingQuery: editor.mediaAssetPendingQuery,
          mediaAssetQuery: editor.mediaAssetQuery,
          mediaFilter: editor.mediaFilter,
          mediaPageIndex: editor.mediaPageIndex,
          mediaRailTab: editor.mediaRailTab,
          playbackSeconds: editor.playbackSeconds,
          previewHasAudio: editor.previewHasAudio,
          project: editor.project,
          savedEditPageIndex: editor.savedEditPageIndex,
          selectedAssetKey: editor.selectedAssetKey,
          selectedClipId: editor.selectedClipId,
          workspace: editor.workspace,
          zoom: editor.zoom,
        },
      },
      null,
      2,
    );

    void writeClipboardText(payload).catch((error) => {
      console.warn("[editor] Failed to copy debug JSON", { error });
    });
  };

  return (
    <button
      className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300"
      title="Copy active editor project and workspace JSON"
      type="button"
      onClick={handleCopyDebugJson}
    >
      <span className="min-w-0 flex-1 truncate">Debug</span>
      <FiCode aria-hidden="true" className="shrink-0" size={14} />
    </button>
  );
}

async function writeClipboardText(text: string): Promise<void> {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.setAttribute("readonly", "true");
  textArea.style.position = "fixed";
  textArea.style.opacity = "0";
  document.body.append(textArea);
  textArea.select();

  try {
    const didCopy = document.execCommand("copy");
    if (!didCopy) {
      throw new Error("Clipboard copy was rejected");
    }
  } finally {
    textArea.remove();
  }
}

export { EditorDebugCopyAction };
