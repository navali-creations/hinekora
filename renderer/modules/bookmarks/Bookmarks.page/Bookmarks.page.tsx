import { useMemo } from "react";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { BookmarkRenameDialog } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarkRenameDialog/BookmarkRenameDialog";
import { BookmarksTable } from "~/renderer/modules/bookmarks/Bookmarks.components/BookmarksTable/BookmarksTable";
import { MediaLibraryPageActions } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryPageActions/MediaLibraryPageActions";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import { buildMediaLibraryLeagueOptions } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { useBookmarksShallow } from "~/renderer/store";

function BookmarksPage() {
  const { scope, setLeague } = useMediaLibraryScope();
  const { availableLeagues, refresh } = useBookmarksShallow((bookmarks) => ({
    availableLeagues: bookmarks.availableLeagues,
    refresh: bookmarks.refresh,
  }));
  const leagueOptions = useMemo(
    () =>
      buildMediaLibraryLeagueOptions(
        scope.game,
        availableLeagues,
        scope.league,
      ),
    [availableLeagues, scope.game, scope.league],
  );

  const handleRefresh = () => {
    void refresh();
  };

  return (
    <PageContainer>
      <PageHeader
        title="Bookmarks"
        subtitle="Gameplay markers for locations, deaths, manual bookmarks, and manual replays."
        actions={
          <MediaLibraryPageActions
            league={scope.league}
            leagueOptions={leagueOptions}
            onLeagueChange={setLeague}
            onRefresh={handleRefresh}
          />
        }
      />
      <PageContent className="grid h-full min-h-0 grid-cols-12 items-stretch gap-4 [grid-auto-flow:dense]">
        <BookmarksTable scope={scope} />
      </PageContent>
      <BookmarkRenameDialog />
    </PageContainer>
  );
}

export { BookmarksPage };
