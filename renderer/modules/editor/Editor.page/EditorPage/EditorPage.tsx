import clsx from "clsx";
import { useEffect } from "react";

import type { EditorMediaReference } from "~/main/modules/editor";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import { useEditorShallow, useSettingsShallow } from "~/renderer/store";

import { EditorAssetRail } from "../../Editor.components/EditorAssetRail/EditorAssetRail";
import { EditorDragDropProvider } from "../../Editor.components/EditorDragDropProvider/EditorDragDropProvider";
import { EditorExportActions } from "../../Editor.components/EditorExportActions/EditorExportActions";
import { EditorExportNotices } from "../../Editor.components/EditorExportNotices/EditorExportNotices";
import { EditorExportView } from "../../Editor.components/EditorExportView/EditorExportView";
import { EditorMediaLeagueControl } from "../../Editor.components/EditorMediaLeagueControl/EditorMediaLeagueControl";
import { EditorPageHeaderActions } from "../../Editor.components/EditorPageHeaderActions/EditorPageHeaderActions";
import { EditorPreviewStage } from "../../Editor.components/EditorPreviewStage/EditorPreviewStage";
import { EditorRecordingBookmarksProvider } from "../../Editor.components/EditorRecordingBookmarksProvider/EditorRecordingBookmarksProvider";
import { EditorSidePanel } from "../../Editor.components/EditorSidePanel/EditorSidePanel";
import { EditorTimelineWithBookmarks } from "../../Editor.components/EditorTimelineWithBookmarks/EditorTimelineWithBookmarks";
import type { EditorRouteTrimDraft } from "./EditorPage.utils";
import { createExportSubtitle, createExportTitle } from "./EditorPage.utils";
import { useEditorKeyboardShortcuts } from "./useEditorKeyboardShortcuts";
import { useEditorRouteHydration } from "./useEditorRouteHydration";
import { useEditorRouteTrimDraft } from "./useEditorRouteTrimDraft/useEditorRouteTrimDraft";

interface EditorPageProps {
  initialTrimDraft?: EditorRouteTrimDraft | null;
  projectId?: string | null;
  source?: EditorMediaReference | null;
}

function EditorPage({
  initialTrimDraft = null,
  projectId = null,
  source = null,
}: EditorPageProps) {
  const { isReady: isMediaScopeReady, scope } = useMediaLibraryScope();
  const {
    error,
    clipboardStatus,
    exportFileName,
    exportProjectId,
    exportResult,
    exportStatus,
    hydrate,
    isLoading,
    isExportViewOpen,
    mediaFilter,
    openProject,
    project,
    setMediaFilter,
    visibleSidePanel,
  } = useEditorShallow((editor) => ({
    clipboardStatus: editor.clipboardState.status,
    error: editor.error,
    exportFileName: editor.exportState.fileName,
    exportProjectId: editor.exportState.projectId,
    exportResult: editor.exportState.result,
    exportStatus: editor.exportState.status,
    hydrate: editor.hydrate,
    isLoading: editor.isLoading,
    isExportViewOpen: editor.exportState.isViewOpen,
    mediaFilter: editor.mediaFilter,
    openProject: editor.openProject,
    project: editor.project,
    setMediaFilter: editor.setMediaFilter,
    visibleSidePanel: editor.visibleSidePanel,
  }));
  const preferredMediaFilter = useSettingsShallow((settings) =>
    settings.value ? (settings.value.editorMediaFilter ?? "death-clip") : null,
  );
  const isClipboardBusy = clipboardStatus === "copying";
  const isBookmarksVisible = visibleSidePanel === "bookmarks";
  const routeProjectId = projectId ?? exportProjectId;

  const isRouteHydrated = useEditorRouteHydration({
    hydrate,
    openProject,
    project,
    projectId: routeProjectId,
    source,
  });
  useEditorRouteTrimDraft({
    draft: initialTrimDraft,
    isRouteHydrated,
    source,
  });
  const isPreferredMediaFilterApplied =
    preferredMediaFilter !== null && mediaFilter === preferredMediaFilter;
  const isAssetRailHydrationEnabled =
    isMediaScopeReady && isRouteHydrated && isPreferredMediaFilterApplied;

  useEffect(() => {
    if (preferredMediaFilter === null || mediaFilter === preferredMediaFilter) {
      return;
    }

    setMediaFilter(preferredMediaFilter);
  }, [mediaFilter, preferredMediaFilter, setMediaFilter]);

  useEditorKeyboardShortcuts();

  if (exportStatus !== "idle" && isExportViewOpen) {
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
        {exportStatus === "exporting" && <EditorExportNotices />}
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
            leagueControl={
              <EditorMediaLeagueControl disabled={isClipboardBusy} />
            }
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
          {
            "grid-cols-[260px_minmax(0,1fr)_260px]": visibleSidePanel !== null,
            "grid-cols-[260px_minmax(0,1fr)]": visibleSidePanel === null,
          },
        )}
      >
        <EditorDragDropProvider>
          <EditorAssetRail
            isHydrationEnabled={isAssetRailHydrationEnabled}
            scope={scope}
          />
          <EditorPreviewStage />
          <EditorRecordingBookmarksProvider isEnabled={isBookmarksVisible}>
            <EditorSidePanel />
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
