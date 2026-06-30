interface EditorShortcutItem {
  category: "editor" | "timeline";
  keys: string[];
  label: string;
}

const editorShortcutEventNames = {
  openDeleteEditDialog: "hinekora:editor-shortcut:open-delete-edit-dialog",
  openSaveDialog: "hinekora:editor-shortcut:open-save-dialog",
} as const;

const editorShortcutItems: EditorShortcutItem[] = [
  {
    category: "timeline",
    keys: ["Del"],
    label: "Delete the selected clip or hovered gap.",
  },
  {
    category: "timeline",
    keys: ["S"],
    label: "Split the selected clip at the playhead.",
  },
  {
    category: "timeline",
    keys: ["M"],
    label: "Mute or restore audio for the selected edit.",
  },
  {
    category: "timeline",
    keys: ["C"],
    label: "Clear empty gaps from the timeline.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "Z"],
    label: "Undo the last timeline edit.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "Y"],
    label: "Redo the last undone edit.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "Shift", "Z"],
    label: "Redo on keyboards that use reverse undo.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "C"],
    label: "Copy the current edit to the clipboard.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "S"],
    label: "Open the save modal.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "N"],
    label: "Create a new edit.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "D"],
    label: "Open the delete edit confirmation.",
  },
  {
    category: "editor",
    keys: ["Ctrl", "H"],
    label: "Toggle the edit history rail.",
  },
  {
    category: "timeline",
    keys: ["Ctrl", "Wheel"],
    label: "Zoom the timeline around the cursor.",
  },
];

const editorTimelineShortcutItems = editorShortcutItems.filter(
  (item) => item.category === "timeline",
);
const editorCommandShortcutItems = editorShortcutItems.filter(
  (item) => item.category === "editor",
);

export type { EditorShortcutItem };
export {
  editorCommandShortcutItems,
  editorShortcutEventNames,
  editorShortcutItems,
  editorTimelineShortcutItems,
};
