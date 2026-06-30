import clsx from "clsx";
import { useMemo, useState } from "react";
import { FiTrash2 as Trash2 } from "react-icons/fi";

import type { ReplayClipLibraryQuery } from "~/main/modules/replay-clips";
import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { MediaLibraryPageActions } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryPageActions/MediaLibraryPageActions";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import {
  ALL_LEAGUES_VALUE,
  buildMediaLibraryLeagueOptions,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";
import { ReplayClipsPanel } from "~/renderer/modules/replay-clips/ReplayClips.components/ReplayClipsPanel/ReplayClipsPanel";
import { useReplayClipsShallow } from "~/renderer/store";

import type { ReplayClipKind } from "~/types";

function ClipsPage() {
  const [clipKind, setClipKind] = useState<ReplayClipKind>("death");
  const {
    clearSelectedClips,
    deleteSelectedClips,
    libraryLeagues,
    selectedClipCount,
  } = useReplayClipsShallow((replayClips) => ({
    clearSelectedClips: replayClips.clearSelectedClips,
    deleteSelectedClips: replayClips.deleteSelectedClips,
    libraryLeagues: replayClips.libraryLeagues,
    selectedClipCount: Object.values(replayClips.selectedClipIds).filter(
      Boolean,
    ).length,
  }));
  const { scope, setLeague } = useMediaLibraryScope();
  const scopedLeagueOptions = useMemo(
    () =>
      buildMediaLibraryLeagueOptions(scope.game, libraryLeagues, scope.league),
    [libraryLeagues, scope.game, scope.league],
  );
  const libraryQuery = useMemo<ReplayClipLibraryQuery>(() => {
    const query: ReplayClipLibraryQuery = {
      game: scope.game,
      kind: clipKind,
    };
    if (scope.league !== ALL_LEAGUES_VALUE) {
      query.league = scope.league;
    }

    return query;
  }, [clipKind, scope.game, scope.league]);
  const showLeagueColumn = scope.league === ALL_LEAGUES_VALUE;
  const tableQueryKey = `${scope.game}:${scope.league}:${clipKind}`;

  const handleDeleteSelected = () => {
    void deleteSelectedClips();
  };

  const handleDeathClipsTab = () => {
    clearSelectedClips();
    setClipKind("death");
  };

  const handleManualClipsTab = () => {
    clearSelectedClips();
    setClipKind("manual");
  };

  return (
    <PageContainer>
      <PageHeader
        title="Clips"
        subtitle="Death clips and manual replay saves filtered by this page."
        actions={
          <MediaLibraryPageActions
            league={scope.league}
            leagueOptions={scopedLeagueOptions}
            leadingAction={
              <div
                aria-label="Clip type"
                className="tabs tabs-box tabs-xs no-drag bg-base-200 p-1"
                role="tablist"
              >
                <button
                  aria-selected={clipKind === "death"}
                  className={clsx(
                    "tab px-3 font-semibold",
                    clipKind === "death" && "tab-active text-primary",
                  )}
                  role="tab"
                  type="button"
                  onClick={handleDeathClipsTab}
                >
                  Death Clips
                </button>
                <button
                  aria-selected={clipKind === "manual"}
                  className={clsx(
                    "tab px-3 font-semibold",
                    clipKind === "manual" && "tab-active text-primary",
                  )}
                  role="tab"
                  type="button"
                  onClick={handleManualClipsTab}
                >
                  Manual Replays
                </button>
              </div>
            }
            bulkAction={
              selectedClipCount > 0 ? (
                <button
                  className="btn btn-error btn-sm no-drag"
                  type="button"
                  onClick={handleDeleteSelected}
                >
                  <Trash2 size={14} />
                  Delete selected ({selectedClipCount})
                </button>
              ) : null
            }
            onLeagueChange={setLeague}
          />
        }
      />
      <PageContent className="grid h-full min-h-0 grid-cols-12 items-stretch gap-4 [grid-auto-flow:dense]">
        <ReplayClipsPanel
          query={libraryQuery}
          queryKey={tableQueryKey}
          showLeagueColumn={showLeagueColumn}
        />
      </PageContent>
    </PageContainer>
  );
}

export { ClipsPage };
