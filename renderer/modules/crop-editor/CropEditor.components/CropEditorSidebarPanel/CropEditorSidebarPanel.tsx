import { CropRegionsEditor } from "~/renderer/modules/crop-editor/CropEditor.components/CropRegionsEditor/CropRegionsEditor";
import { OverlayPlacementsEditor } from "~/renderer/modules/crop-editor/CropEditor.components/OverlayPlacementsEditor/OverlayPlacementsEditor";

function CropEditorSidebarPanel() {
  return (
    <section className="col-span-3 grid min-w-0 content-start gap-2 rounded-lg border border-base-content/10 bg-neutral p-2 shadow-lg">
      <CropRegionsEditor />
      <OverlayPlacementsEditor />
    </section>
  );
}

export { CropEditorSidebarPanel };
