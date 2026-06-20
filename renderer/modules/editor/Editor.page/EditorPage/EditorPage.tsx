import clsx from "clsx";
import { useEffect, useState } from "react";

import type { EditorMediaReference } from "~/main/modules/editor";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { useEditorShallow } from "~/renderer/store";

import { EditorActionsMenu } from "../../Editor.components/EditorActionsMenu/EditorActionsMenu";
import { EditorAssetRail } from "../../Editor.components/EditorAssetRail/EditorAssetRail";
import { EditorDragDropProvider } from "../../Editor.components/EditorDragDropProvider/EditorDragDropProvider";
import { EditorExportActions } from "../../Editor.components/EditorExportActions/EditorExportActions";
import { EditorExportView } from "../../Editor.components/EditorExportView/EditorExportView";
import { EditorHistoryRail } from "../../Editor.components/EditorHistoryRail/EditorHistoryRail";
import { EditorPreviewStage } from "../../Editor.components/EditorPreviewStage/EditorPreviewStage";
import { EditorProjectPicker } from "../../Editor.components/EditorProjectPicker/EditorProjectPicker";
import { EditorTimeline } from "../../Editor.components/EditorTimeline/EditorTimeline";
import {
  createExportSubtitle,
  createExportTitle,
  shouldHydrateEditorProject,
} from "./EditorPage.utils";

interface EditorPageProps {
  source?: EditorMediaReference | null;
}

function EditorPage({ source = null }: EditorPageProps) {
  const sourceId = source?.id;
  const sourceKind = source?.kind;
  const [isHistoryVisible, setHistoryVisible] = useState(false);
  const {
    error,
    exportFileName,
    exportResult,
    exportStatus,
    hoveredTimelineGap,
    hydrate,
    isLoading,
    project,
    redoProjectChange,
    removeTimelineGap,
    removeTimelineClip,
    setHoveredTimelineGap,
    selectedClipId,
    undoProjectChange,
  } = useEditorShallow((editor) => ({
    error: editor.error,
    exportFileName: editor.exportState.fileName,
    exportResult: editor.exportState.result,
    exportStatus: editor.exportState.status,
    hoveredTimelineGap: editor.hoveredTimelineGap,
    hydrate: editor.hydrate,
    isLoading: editor.isLoading,
    project: editor.project,
    redoProjectChange: editor.redoProjectChange,
    removeTimelineGap: editor.removeTimelineGap,
    removeTimelineClip: editor.removeTimelineClip,
    setHoveredTimelineGap: editor.setHoveredTimelineGap,
    selectedClipId: editor.selectedClipId,
    undoProjectChange: editor.undoProjectChange,
  }));

  const handleToggleHistory = () => {
    setHistoryVisible((isVisible) => !isVisible);
  };

  const handleCloseHistory = () => {
    setHistoryVisible(false);
  };

  useEffect(() => {
    if (
      project &&
      !shouldHydrateEditorProject({ project, sourceId, sourceKind })
    ) {
      return;
    }

    void hydrate(
      sourceId && sourceKind ? { id: sourceId, kind: sourceKind } : null,
    );
  }, [hydrate, project, sourceId, sourceKind]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target;
      if (
        target instanceof HTMLElement &&
        (target.isContentEditable ||
          target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT")
      ) {
        return;
      }

      if (event.key === "Delete") {
        if (hoveredTimelineGap) {
          event.preventDefault();
          removeTimelineGap({
            endSeconds: hoveredTimelineGap.endSeconds,
            startSeconds: hoveredTimelineGap.startSeconds,
          });
          setHoveredTimelineGap(null);
          return;
        }

        if (selectedClipId) {
          event.preventDefault();
          removeTimelineClip(selectedClipId);
          return;
        }
      }

      const usesModifier = event.ctrlKey || event.metaKey;
      if (!usesModifier || event.altKey) {
        return;
      }

      const key = event.key.toLowerCase();
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
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    redoProjectChange,
    hoveredTimelineGap,
    removeTimelineGap,
    removeTimelineClip,
    setHoveredTimelineGap,
    selectedClipId,
    undoProjectChange,
  ]);

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
    <PageContainer className="gap-4">
      <PageHeader
        actions={
          <>
            <EditorProjectPicker />
            <EditorActionsMenu
              isHistoryVisible={isHistoryVisible}
              onToggleHistory={handleToggleHistory}
            />
          </>
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
          "grid h-full min-h-0 grid-rows-[minmax(0,1fr)_220px] gap-3 !overflow-hidden",
          isHistoryVisible
            ? "grid-cols-[260px_minmax(0,1fr)_260px]"
            : "grid-cols-[260px_minmax(0,1fr)]",
        )}
      >
        <EditorDragDropProvider>
          <EditorAssetRail />
          <EditorPreviewStage />
          {isHistoryVisible && (
            <EditorHistoryRail onClose={handleCloseHistory} />
          )}
          <EditorTimeline />
        </EditorDragDropProvider>
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
