import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";

import type { EditorMediaReference } from "~/main/modules/editor";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import { buildMediaLibraryLeagueOptions } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import {
  useBookmarksShallow,
  useEditorShallow,
  useSavedEditsShallow,
} from "~/renderer/store";

import { EditorAssetRail } from "../../Editor.components/EditorAssetRail/EditorAssetRail";
import { EditorDragDropProvider } from "../../Editor.components/EditorDragDropProvider/EditorDragDropProvider";
import { EditorExportActions } from "../../Editor.components/EditorExportActions/EditorExportActions";
import { EditorExportView } from "../../Editor.components/EditorExportView/EditorExportView";
import { EditorPageHeaderActions } from "../../Editor.components/EditorPageHeaderActions/EditorPageHeaderActions";
import { EditorPreviewStage } from "../../Editor.components/EditorPreviewStage/EditorPreviewStage";
import { EditorRecordingBookmarksProvider } from "../../Editor.components/EditorRecordingBookmarksProvider/EditorRecordingBookmarksProvider";
import {
  EditorSidePanel,
  type EditorSidePanelKind,
} from "../../Editor.components/EditorSidePanel/EditorSidePanel";
import { EditorTimelineWithBookmarks } from "../../Editor.components/EditorTimelineWithBookmarks/EditorTimelineWithBookmarks";
import { createExportSubtitle, createExportTitle } from "./EditorPage.utils";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { useEditorRouteHydration } from "./useEditorRouteHydration";

interface EditorPageProps {
  projectId?: string | null;
  source?: EditorMediaReference | null;
}

function EditorPage({ projectId = null, source = null }: EditorPageProps) {
  const [visibleSidePanel, setVisibleSidePanel] =
    useState<EditorSidePanelKind | null>(null);
  const {
    isReady: isMediaScopeReady,
    scope,
    setLeague,
  } = useMediaLibraryScope();
  const savedEditAvailableLeagues = useSavedEditsShallow(
    (savedEdits) => savedEdits.libraryPage?.availableLeagues ?? [],
  );
  const {
    error,
    clipboardStatus,
    exportFileName,
    exportResult,
    exportStatus,
    hydrate,
    isLoading,
    openProject,
    project,
    workspace,
  } = useEditorShallow((editor) => ({
    clipboardStatus: editor.clipboardState.status,
    error: editor.error,
    exportFileName: editor.exportState.fileName,
    exportResult: editor.exportState.result,
    exportStatus: editor.exportState.status,
    hydrate: editor.hydrate,
    isLoading: editor.isLoading,
    openProject: editor.openProject,
    project: editor.project,
    workspace: editor.workspace,
  }));
  const isClipboardBusy = clipboardStatus === "copying";
  const isBookmarksVisible = visibleSidePanel === "bookmarks";
  const isHistoryVisible = visibleSidePanel === "history";
  const isShortcutsVisible = visibleSidePanel === "shortcuts";
  const {
    hasSelectedBookmark,
    setSelectedBookmarkId: setEditorRecordingSelectedBookmarkId,
  } = useBookmarksShallow((bookmarks) => ({
    hasSelectedBookmark: bookmarks.editorRecording.selectedBookmarkId !== null,
    setSelectedBookmarkId: bookmarks.setEditorRecordingSelectedBookmarkId,
  }));
  const editorMediaLeagueOptions = useMemo(() => {
    const mediaLeagues =
      workspace?.assets
        .filter((asset) => asset.sourceGame === scope.game)
        .map((asset) => asset.sourceLeague) ?? [];

    return buildMediaLibraryLeagueOptions(
      scope.game,
      [...mediaLeagues, ...savedEditAvailableLeagues],
      scope.league,
    );
  }, [savedEditAvailableLeagues, scope.game, scope.league, workspace?.assets]);

  const handleToggleHistory = useCallback(() => {
    setVisibleSidePanel((currentPanel) =>
      currentPanel === "history" ? null : "history",
    );
  }, []);

  const handleToggleBookmarks = useCallback(() => {
    setVisibleSidePanel((currentPanel) =>
      currentPanel === "bookmarks" ? null : "bookmarks",
    );
  }, []);

  const handleToggleShortcuts = () => {
    setVisibleSidePanel((currentPanel) =>
      currentPanel === "shortcuts" ? null : "shortcuts",
    );
  };

  const handleCloseSidePanel = () => setVisibleSidePanel(null);

  const handleClearSelectedBookmark = useCallback(() => {
    setEditorRecordingSelectedBookmarkId(null);
  }, [setEditorRecordingSelectedBookmarkId]);

  const isRouteHydrated = useEditorRouteHydration({
    hydrate,
    openProject,
    project,
    projectId,
    source,
  });
  const isAssetRailHydrationEnabled = isMediaScopeReady && isRouteHydrated;

  useEditorKeyboardShortcuts({
    hasSelectedBookmark,
    onClearSelectedBookmark: handleClearSelectedBookmark,
    onToggleBookmarks: handleToggleBookmarks,
    onToggleHistory: handleToggleHistory,
  });

  if (exportStatus !== "idle") {
    return (
      <PageContainer className="relative gap-4">
        <PageHeader
          actions={<EditorExportActions />}
          subtitle={createExportSubtitle({
            fileName: exportFileName,
            result: exportResult,
            status: exportStatus,
          })}
          title={createExportTitle(exportStatus)}
        />
        <PageContent className="grid min-h-0 !overflow-hidden">
          <EditorExportView />
        </PageContent>
        {isLoading && (
          <div className="pointer-events-none absolute inset-0 grid place-items-center bg-base-300/45">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        )}
      </PageContainer>
    );
  }

  return (
    <PageContainer className="relative gap-4">
      <PageHeader
        actions={
          <EditorPageHeaderActions
            isClipboardBusy={isClipboardBusy}
            isBookmarksVisible={isBookmarksVisible}
            isHistoryVisible={isHistoryVisible}
            isShortcutsVisible={isShortcutsVisible}
            league={scope.league}
            leagueOptions={editorMediaLeagueOptions}
            onLeagueChange={setLeague}
            onToggleBookmarks={handleToggleBookmarks}
            onToggleHistory={handleToggleHistory}
            onToggleShortcuts={handleToggleShortcuts}
          />
        }
        title="Editor"
      />
      {error && (
        <div className="alert alert-error py-2 text-sm" role="alert">
          {error}
        </div>
      )}
      <PageContent
        className={clsx(
          "relative grid h-full min-h-0 grid-rows-[minmax(0,1fr)_220px] gap-3 !overflow-hidden",
          visibleSidePanel
            ? "grid-cols-[260px_minmax(0,1fr)_260px]"
            : "grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        <EditorDragDropProvider>
          <EditorAssetRail
            isHydrationEnabled={isAssetRailHydrationEnabled}
            scope={scope}
          />
          <EditorPreviewStage />
          <EditorRecordingBookmarksProvider isEnabled={isBookmarksVisible}>
            <EditorSidePanel
              visibleSidePanel={visibleSidePanel}
              onClose={handleCloseSidePanel}
            />
            <EditorTimelineWithBookmarks />
          </EditorRecordingBookmarksProvider>
        </EditorDragDropProvider>
        {isClipboardBusy && (
          <div
            aria-hidden="true"
            className="absolute inset-0 z-40 bg-base-100/10"
          />
        )}
      </PageContent>
      {isLoading && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center bg-base-300/45">
          <span className="loading loading-spinner loading-lg text-primary" />
        </div>
      )}
    </PageContainer>
  );
}

export { EditorPage };
