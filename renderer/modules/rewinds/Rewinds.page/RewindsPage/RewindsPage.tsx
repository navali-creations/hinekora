import { useCallback, useMemo, useState } from "react";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { MediaLibraryPageActions } from "~/renderer/modules/media-library/MediaLibrary.components/MediaLibraryPageActions/MediaLibraryPageActions";
import { useMediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.hooks/useMediaLibraryScope/useMediaLibraryScope";
import { buildMediaLibraryLeagueOptions } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { RewindsPanel } from "../../Rewinds.components/RewindsPanel/RewindsPanel";

function RewindsPage() {
  const { scope, setLeague } = useMediaLibraryScope();
  const [availableLeagues, setAvailableLeagues] = useState<string[]>([]);
  const scopedLeagueOptions = useMemo(
    () =>
      buildMediaLibraryLeagueOptions(
        scope.game,
        availableLeagues,
        scope.league,
      ),
    [availableLeagues, scope.game, scope.league],
  );
  const handleAvailableLeaguesChange = useCallback((leagues: string[]) => {
    setAvailableLeagues(leagues);
  }, []);

  return (
    <PageContainer>
      <PageHeader
        title="Rewinds"
        subtitle="Tracked rewind activity sessions with bookmarks and linked replay clips."
        actions={
          <MediaLibraryPageActions
            league={scope.league}
            leagueOptions={scopedLeagueOptions}
            onLeagueChange={setLeague}
          />
        }
      />
      <PageContent className="grid h-full min-h-0 grid-cols-12 items-stretch gap-4 [grid-auto-flow:dense]">
        <RewindsPanel
          scope={scope}
          onAvailableLeaguesChange={handleAvailableLeaguesChange}
        />
      </PageContent>
    </PageContainer>
  );
}

export { RewindsPage };
