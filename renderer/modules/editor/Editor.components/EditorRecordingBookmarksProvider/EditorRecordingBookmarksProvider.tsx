import { createContext, type ReactNode, useContext } from "react";

import { useEditorShallow } from "~/renderer/store";

import {
  type EditorRecordingBookmarksData,
  useEditorRecordingBookmarks,
} from "../../Editor.page/EditorPage/useEditorRecordingBookmarks/useEditorRecordingBookmarks";

const EditorRecordingBookmarksContext =
  createContext<EditorRecordingBookmarksData | null>(null);

interface EditorRecordingBookmarksProviderProps {
  children: ReactNode;
  isEnabled: boolean;
}

function EditorRecordingBookmarksProvider({
  children,
  isEnabled,
}: EditorRecordingBookmarksProviderProps) {
  const { project, selectedClipId } = useEditorShallow((editor) => ({
    project: editor.project,
    selectedClipId: editor.selectedClipId,
  }));
  const bookmarks = useEditorRecordingBookmarks({
    isEnabled,
    project,
    selectedClipId,
  });

  return (
    <EditorRecordingBookmarksContext.Provider value={bookmarks}>
      {children}
    </EditorRecordingBookmarksContext.Provider>
  );
}

function useEditorRecordingBookmarksContext() {
  const bookmarks = useContext(EditorRecordingBookmarksContext);
  if (!bookmarks) {
    throw new Error(
      "useEditorRecordingBookmarksContext must be used inside EditorRecordingBookmarksProvider",
    );
  }

  return bookmarks;
}

export { EditorRecordingBookmarksProvider, useEditorRecordingBookmarksContext };
