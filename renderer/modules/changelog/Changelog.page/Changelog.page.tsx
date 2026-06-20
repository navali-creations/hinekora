import { useEffect } from "react";

import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";
import { useChangelog } from "~/renderer/store";

import { ReleaseTimelineItem } from "../Changelog.components";

function ChangelogPage() {
  const { releases, isLoading, error, fetchChangelog } = useChangelog();

  useEffect(() => {
    void fetchChangelog();
  }, [fetchChangelog]);

  if (isLoading) {
    return (
      <PageContainer>
        <PageHeader title="Changelog" subtitle="Loading release history." />
        <PageContent>
          <div className="grid h-full place-items-center">
            <span className="loading loading-spinner loading-lg text-primary" />
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  if (error) {
    return (
      <PageContainer>
        <PageHeader title="Changelog" subtitle="Release history unavailable." />
        <PageContent>
          <div className="grid h-full place-items-center">
            <div className="alert alert-error max-w-md">
              <span>{error}</span>
            </div>
          </div>
        </PageContent>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <PageHeader
        title="Changelog"
        subtitle="Release history and updates. Click any card to open the release page on GitHub."
      />
      <PageContent>
        <div className="px-2 pb-8">
          {releases.length > 0 ? (
            <ul className="m-0 list-none p-0">
              {releases.map((release, index) => (
                <ReleaseTimelineItem
                  key={release.version}
                  release={release}
                  isLast={index === releases.length - 1}
                  isCurrent={index === 0}
                />
              ))}
            </ul>
          ) : (
            <div className="grid h-32 place-items-center text-base-content/50">
              <span>No changelog entries found.</span>
            </div>
          )}
        </div>
      </PageContent>
    </PageContainer>
  );
}

export { ChangelogPage };
