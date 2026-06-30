import clsx from "clsx";

import type { MediaLibraryScope } from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

import { EditorAssetRailFilter } from "../EditorAssetRailFilter/EditorAssetRailFilter";
import { EditorAssetRailHeader } from "../EditorAssetRailHeader/EditorAssetRailHeader";
import { EditorAssetRailList } from "../EditorAssetRailList/EditorAssetRailList";
import { EditorAssetRailPagination } from "../EditorAssetRailPagination/EditorAssetRailPagination";
import { EditorAssetRailTabs } from "../EditorAssetRailTabs/EditorAssetRailTabs";
import { useEditorAssetRailHydration } from "./useEditorAssetRailHydration/useEditorAssetRailHydration";
import { useEditorAssetRailPageModel } from "./useEditorAssetRailPageModel/useEditorAssetRailPageModel";
import { useEditorAssetRailSelectedPage } from "./useEditorAssetRailSelectedPage/useEditorAssetRailSelectedPage";

function EditorAssetRail({ scope }: { scope: MediaLibraryScope }) {
  const pageModel = useEditorAssetRailPageModel(scope);
  const { isProcessing, isSavedEditsFilter } = pageModel;

  useEditorAssetRailHydration(pageModel);
  useEditorAssetRailSelectedPage(pageModel);

  return (
    <aside
      aria-disabled={isProcessing}
      className={clsx(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-base-content/10 bg-base-200 transition-opacity",
        isProcessing && "pointer-events-none opacity-50",
      )}
      data-onboarding="editor-my-media"
    >
      <EditorAssetRailHeader pageModel={pageModel} scope={scope} />

      <EditorAssetRailFilter />
      {!isSavedEditsFilter && <EditorAssetRailTabs />}

      <EditorAssetRailList pageModel={pageModel} />
      <EditorAssetRailPagination pageModel={pageModel} />
    </aside>
  );
}

export { EditorAssetRail };
