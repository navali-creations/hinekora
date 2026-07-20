import { useEffect } from "react";

import { useBookmarksShallow, useEditorShallow } from "~/renderer/store";

import { editorShortcutEventNames } from "../../Editor.utils/EditorShortcuts.utils";
import {
  isEditorDeleteShortcut,
  isEditorShortcutSuppressedTarget,
  isEditorTimelineShortcutTarget,
} from "./EditorPage.utils";

function useEditorKeyboardShortcuts(): void {
  const {
    activeClipId,
    clipboardStatus,
    copyProjectToClipboard,
    createProject,
    exportStatus,
    hasProject,
    hoveredTimelineGap,
    playbackSeconds,
    previewHasAudio,
    redoProjectChange,
    removeAllTimelineGaps,
    removeTimelineClip,
    removeTimelineGap,
    setHoveredTimelineGap,
    splitTimelineClipAt,
    toggleProjectAudioMuted,
    toggleSidePanel,
    undoProjectChange,
  } = useEditorShallow((editor) => ({
    activeClipId: editor.selectedClipId ?? editor.project?.activeClipId ?? null,
    clipboardStatus: editor.clipboardState.status,
    copyProjectToClipboard: editor.copyProjectToClipboard,
    createProject: editor.createProject,
    exportStatus: editor.exportState.status,
    hasProject: editor.project !== null,
    hoveredTimelineGap: editor.hoveredTimelineGap,
    playbackSeconds: editor.playbackSeconds,
    previewHasAudio: editor.previewHasAudio,
    redoProjectChange: editor.redoProjectChange,
    removeAllTimelineGaps: editor.removeAllTimelineGaps,
    removeTimelineClip: editor.removeTimelineClip,
    removeTimelineGap: editor.removeTimelineGap,
    setHoveredTimelineGap: editor.setHoveredTimelineGap,
    splitTimelineClipAt: editor.splitTimelineClipAt,
    toggleProjectAudioMuted: editor.toggleProjectAudioMuted,
    toggleSidePanel: editor.toggleSidePanel,
    undoProjectChange: editor.undoProjectChange,
  }));
  const { hasSelectedBookmark, setSelectedBookmarkId } = useBookmarksShallow(
    (bookmarks) => ({
      hasSelectedBookmark:
        bookmarks.editorRecording.selectedBookmarkId !== null,
      setSelectedBookmarkId: bookmarks.setEditorRecordingSelectedBookmarkId,
    }),
  );
  const isProcessing = clipboardStatus === "copying";

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;

      if (isEditorShortcutSuppressedTarget(target)) {
        return;
      }

      if (event.key === "Escape" && hasSelectedBookmark) {
        event.preventDefault();
        setSelectedBookmarkId(null);
        return;
      }

      const usesModifier = event.ctrlKey || event.metaKey;
      if (usesModifier && !event.altKey) {
        const key = event.key.toLowerCase();
        if (key === "h") {
          event.preventDefault();
          toggleSidePanel("history");
          return;
        }

        if (key === "b") {
          event.preventDefault();
          toggleSidePanel("bookmarks");
          return;
        }

        if (exportStatus === "exporting" && (key === "c" || key === "s")) {
          event.preventDefault();
          return;
        }

        if (isProcessing) {
          if (["z", "y", "c", "s", "n", "d"].includes(key)) {
            event.preventDefault();
          }

          return;
        }

        if (key === "z" && event.shiftKey) {
          event.preventDefault();
          redoProjectChange();
          return;
        }

        if (key === "z") {
          event.preventDefault();
          undoProjectChange();
          return;
        }

        if (key === "y") {
          event.preventDefault();
          redoProjectChange();
          return;
        }

        if (key === "c") {
          event.preventDefault();
          void copyProjectToClipboard();
          return;
        }

        if (key === "s") {
          event.preventDefault();
          window.dispatchEvent(
            new Event(editorShortcutEventNames.openSaveDialog),
          );
          return;
        }

        if (key === "n") {
          event.preventDefault();
          void createProject({ assetKeys: [] });
          return;
        }

        if (key === "d") {
          event.preventDefault();
          window.dispatchEvent(
            new Event(editorShortcutEventNames.openDeleteEditDialog),
          );
          return;
        }
      }

      if (isProcessing) {
        if (isEditorDeleteShortcut(event)) {
          event.preventDefault();
          return;
        }

        if (
          !usesModifier &&
          !event.altKey &&
          !event.shiftKey &&
          isEditorTimelineShortcutTarget(target) &&
          ["s", "m", "c"].includes(event.key.toLowerCase())
        ) {
          event.preventDefault();
        }

        return;
      }

      if (isEditorDeleteShortcut(event)) {
        if (hoveredTimelineGap) {
          event.preventDefault();
          removeTimelineGap({
            endSeconds: hoveredTimelineGap.endSeconds,
            startSeconds: hoveredTimelineGap.startSeconds,
          });
          setHoveredTimelineGap(null);
          return;
        }

        if (activeClipId) {
          event.preventDefault();
          removeTimelineClip(activeClipId);
          return;
        }
      }

      if (
        usesModifier ||
        event.altKey ||
        event.shiftKey ||
        !isEditorTimelineShortcutTarget(target)
      ) {
        return;
      }

      const timelineKey = event.key.toLowerCase();
      if (timelineKey === "s") {
        if (activeClipId) {
          event.preventDefault();
          splitTimelineClipAt(playbackSeconds);
        }
        return;
      }

      if (timelineKey === "m") {
        if (activeClipId && hasProject && previewHasAudio !== false) {
          event.preventDefault();
          toggleProjectAudioMuted();
        }
        return;
      }

      if (timelineKey === "c") {
        event.preventDefault();
        removeAllTimelineGaps();
      }
    };

    window.addEventListener("keydown", handleKeyDown, true);

    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
    };
  }, [
    activeClipId,
    copyProjectToClipboard,
    createProject,
    hasSelectedBookmark,
    hoveredTimelineGap,
    hasProject,
    isProcessing,
    exportStatus,
    playbackSeconds,
    previewHasAudio,
    redoProjectChange,
    removeAllTimelineGaps,
    removeTimelineClip,
    removeTimelineGap,
    setHoveredTimelineGap,
    setSelectedBookmarkId,
    splitTimelineClipAt,
    toggleProjectAudioMuted,
    toggleSidePanel,
    undoProjectChange,
  ]);
}

export { useEditorKeyboardShortcuts };
