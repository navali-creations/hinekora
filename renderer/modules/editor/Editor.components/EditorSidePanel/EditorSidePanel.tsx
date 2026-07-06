import { EditorBookmarksRail } from "../EditorBookmarksRail/EditorBookmarksRail";
import { EditorHistoryRail } from "../EditorHistoryRail/EditorHistoryRail";
import { EditorShortcutsRail } from "../EditorShortcutsRail/EditorShortcutsRail";

type EditorSidePanelKind = "bookmarks" | "history" | "shortcuts";

interface EditorSidePanelProps {
  visibleSidePanel: EditorSidePanelKind | null;
  onClose: () => void;
}

function EditorSidePanel({ visibleSidePanel, onClose }: EditorSidePanelProps) {
  if (visibleSidePanel === "bookmarks") {
    return <EditorBookmarksRail onClose={onClose} />;
  }

  if (visibleSidePanel === "history") {
    return <EditorHistoryRail onClose={onClose} />;
  }

  if (visibleSidePanel === "shortcuts") {
    return <EditorShortcutsRail onClose={onClose} />;
  }

  return null;
}

export type { EditorSidePanelKind };
export { EditorSidePanel };
