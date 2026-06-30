import { FiChevronLeft, FiChevronRight } from "react-icons/fi";

import { useEditorShallow } from "~/renderer/store";

import type { EditorAssetRailPageModel } from "../EditorAssetRail/useEditorAssetRailPageModel/useEditorAssetRailPageModel";

type EditorAssetRailPaginationModel = Pick<
  EditorAssetRailPageModel,
  | "isSavedEditsFilter"
  | "pageCount"
  | "pageIndex"
  | "paginationDisabled"
  | "totalCount"
>;

function EditorAssetRailPagination({
  pageModel,
}: {
  pageModel: EditorAssetRailPaginationModel;
}) {
  const { setMediaPageIndex, setSavedEditPageIndex } = useEditorShallow(
    (editor) => ({
      setMediaPageIndex: editor.setMediaPageIndex,
      setSavedEditPageIndex: editor.setSavedEditPageIndex,
    }),
  );
  const {
    isSavedEditsFilter,
    pageCount,
    pageIndex,
    paginationDisabled,
    totalCount,
  } = pageModel;
  const normalizedPageCount = Math.max(1, pageCount);
  const normalizedPageIndex = Math.min(
    Math.max(pageIndex, 0),
    normalizedPageCount - 1,
  );
  const canGoPrevious = !paginationDisabled && normalizedPageIndex > 0;
  const canGoNext =
    !paginationDisabled && normalizedPageIndex < normalizedPageCount - 1;

  const handlePageChange = (nextPageIndex: number) => {
    if (paginationDisabled) {
      return;
    }

    if (isSavedEditsFilter) {
      setSavedEditPageIndex(nextPageIndex);
      return;
    }

    setMediaPageIndex(nextPageIndex);
  };

  const handlePrevious = () => {
    if (canGoPrevious) {
      handlePageChange(normalizedPageIndex - 1);
    }
  };

  const handleNext = () => {
    if (canGoNext) {
      handlePageChange(normalizedPageIndex + 1);
    }
  };

  return (
    <div className="flex shrink-0 items-center justify-between gap-2 border-base-content/10 border-t bg-base-200 px-3 py-2">
      <span className="text-base-content/55 text-xs">
        {totalCount} item{totalCount === 1 ? "" : "s"}
      </span>
      <div className="join items-center">
        <button
          aria-label="Previous media page"
          className="btn btn-ghost btn-xs join-item"
          disabled={!canGoPrevious}
          type="button"
          onClick={handlePrevious}
        >
          <FiChevronLeft aria-hidden size={14} />
        </button>
        <span className="join-item border-base-content/10 border-x px-2 text-base-content/65 text-xs leading-6">
          {normalizedPageIndex + 1} / {normalizedPageCount}
        </span>
        <button
          aria-label="Next media page"
          className="btn btn-ghost btn-xs join-item"
          disabled={!canGoNext}
          type="button"
          onClick={handleNext}
        >
          <FiChevronRight aria-hidden size={14} />
        </button>
      </div>
    </div>
  );
}

export { EditorAssetRailPagination };
