import { useEffect, useRef, useState } from "react";
import { FiTrash2 } from "react-icons/fi";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { EditorDeleteConfirmationModal } from "~/renderer/modules/editor/Editor.components/EditorDeleteConfirmationModal/EditorDeleteConfirmationModal";
import { MediaLibraryLeagueControl } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryLeagueControl/MediaLibraryLeagueControl";
import { MediaLibraryPageActions } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryPageActions/MediaLibraryPageActions";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import { SavedEditsPanel } from "~/renderer/modules/saved-edits/SavedEdits.components/SavedEditsPanel/SavedEditsPanel";
import { useSavedEditsShallow } from "~/renderer/store";

const emptyLibraryMetadata = {
  availableLeagues: [] as string[],
  globalTotalCount: 0,
};

function SavedEditsPage() {
  const [isDeleteAllConfirmOpen, setDeleteAllConfirmOpen] = useState(false);
  const { isReady: isMediaScopeReady, scope } = useMediaLibraryScope();
  const { deleteAllEdits, libraryPage, libraryQuery } = useSavedEditsShallow(
    (savedEdits) => ({
      deleteAllEdits: savedEdits.deleteAllEdits,
      libraryPage: savedEdits.libraryPage,
      libraryQuery: savedEdits.libraryQuery,
    }),
  );
  const currentLibraryPage =
    libraryQuery?.game === scope.game ? libraryPage : null;
  const lastKnownLibraryMetadataRef = useRef({
    game: scope.game,
    availableLeagues: [] as string[],
    globalTotalCount: 0,
  });

  useEffect(() => {
    if (!currentLibraryPage) {
      return;
    }

    lastKnownLibraryMetadataRef.current = {
      game: scope.game,
      availableLeagues: [...currentLibraryPage.availableLeagues],
      globalTotalCount: currentLibraryPage.globalTotalCount,
    };
  }, [currentLibraryPage, scope.game]);

  const libraryMetadata =
    currentLibraryPage ??
    (lastKnownLibraryMetadataRef.current.game === scope.game
      ? lastKnownLibraryMetadataRef.current
      : emptyLibraryMetadata);
  const hasSavedEdits = libraryMetadata.globalTotalCount > 0;

  const handleOpenDeleteAllConfirm = () => {
    if (!hasSavedEdits) {
      return;
    }

    setDeleteAllConfirmOpen(true);
  };

  const handleCloseDeleteAllConfirm = () => {
    setDeleteAllConfirmOpen(false);
  };

  const handleConfirmDeleteAll = () => {
    void deleteAllEdits();
    setDeleteAllConfirmOpen(false);
  };

  const pageActions = (
    <MediaLibraryPageActions
      bulkAction={
        hasSavedEdits && (
          <>
            <button
              className="btn btn-error btn-sm"
              type="button"
              onClick={handleOpenDeleteAllConfirm}
            >
              <FiTrash2 size={15} />
              Delete all edits
            </button>
            <EditorDeleteConfirmationModal
              confirmLabel="Delete all edits"
              description="This will remove every draft edit. Source recordings and clips will not be deleted."
              isOpen={isDeleteAllConfirmOpen}
              title="Delete all edits?"
              onClose={handleCloseDeleteAllConfirm}
              onConfirm={handleConfirmDeleteAll}
            />
          </>
        )
      }
      leagueControl={
        <MediaLibraryLeagueControl
          savedLeagues={libraryMetadata.availableLeagues}
        />
      }
    />
  );

  return (
    <PageContainer className="gap-4">
      <PageHeader
        actions={pageActions}
        subtitle="Editor timelines saved while you work. Open a draft to continue from its latest state."
        title="Draft Edits"
      />
      <PageContent className="grid min-h-0 grid-cols-12">
        <SavedEditsPanel isScopeReady={isMediaScopeReady} scope={scope} />
      </PageContent>
    </PageContainer>
  );
}

export { SavedEditsPage };
