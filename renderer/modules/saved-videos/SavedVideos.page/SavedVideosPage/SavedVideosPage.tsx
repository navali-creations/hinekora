import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { PageHeader } from "~/renderer/components/PageHeader/PageHeader";

import { SavedVideosPanel } from "../../SavedVideos.components/SavedVideosPanel/SavedVideosPanel";

function SavedVideosPage() {
  return (
    <PageContainer className="gap-4">
      <PageHeader
        subtitle="Finished videos exported from the editor, including videos saved by earlier Hinekora versions."
        title="Saved Edits"
      />
      <PageContent className="grid min-h-0 grid-cols-12">
        <SavedVideosPanel />
      </PageContent>
    </PageContainer>
  );
}

export { SavedVideosPage };
