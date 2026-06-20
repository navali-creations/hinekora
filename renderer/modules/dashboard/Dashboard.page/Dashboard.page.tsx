import { PageContainer } from "~/renderer/components/PageContainer/PageContainer";
import { PageContent } from "~/renderer/components/PageContent/PageContent";
import { CapturePreviewPanel } from "~/renderer/modules/capture-preview/CapturePreview.components/CapturePreviewPanel/CapturePreviewPanel";
import { CaptureModePageHeader } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/CaptureModePageHeader/CaptureModePageHeader";
import { ManagedRecorderPanel } from "~/renderer/modules/managed-recorder/ManagedRecorder.components/ManagedRecorderPanel/ManagedRecorderPanel";

function DashboardPage() {
  return (
    <PageContainer>
      <CaptureModePageHeader
        title="Dashboard"
        subtitle="Live capture preview and capture controls for the active game."
      />
      <PageContent className="grid grid-cols-12 items-start gap-3 [grid-auto-flow:dense]">
        <CapturePreviewPanel />
        <ManagedRecorderPanel />
      </PageContent>
    </PageContainer>
  );
}

export { DashboardPage };
