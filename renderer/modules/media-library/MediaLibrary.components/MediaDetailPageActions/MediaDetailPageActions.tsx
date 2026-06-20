import type { ReactNode } from "react";
import { FiCheck, FiCopy, FiFolder, FiInfo } from "react-icons/fi";

import { PageBackButton } from "~/renderer/components/PageBackButton/PageBackButton";

type MediaDetailCopyState = "idle" | "copying" | "copied";

interface MediaDetailPageActionsProps {
  canUseFileActions: boolean;
  copyState: MediaDetailCopyState;
  extraAction?: ReactNode;
  fallbackTo: "/clips" | "/recordings";
  onCopy: () => void;
  onOpenLocation: () => void;
}

function MediaDetailPageActions({
  canUseFileActions,
  copyState,
  extraAction = null,
  fallbackTo,
  onCopy,
  onOpenLocation,
}: MediaDetailPageActionsProps) {
  const isCopying = copyState === "copying";
  const isCopied = copyState === "copied";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <PageBackButton fallbackTo={fallbackTo} />
      {extraAction}
      <button
        className="btn btn-primary btn-sm no-drag"
        disabled={!canUseFileActions}
        type="button"
        onClick={onOpenLocation}
      >
        <FiFolder size={15} />
        Open location
      </button>
      <div className="flex items-center gap-1.5">
        <button
          className="btn btn-primary btn-sm no-drag"
          disabled={!canUseFileActions || isCopying}
          type="button"
          onClick={onCopy}
        >
          {isCopying && <span className="loading loading-spinner loading-xs" />}
          {!isCopying && isCopied && <FiCheck size={15} />}
          {!isCopying && !isCopied && <FiCopy size={15} />}
          {isCopied ? "Copied" : "Copy to clipboard"}
        </button>
        <span
          aria-label="Clipboard sharing info"
          className="tooltip tooltip-bottom tooltip-primary flex items-center"
          data-tip="Copied videos can be pasted directly into Discord and other apps that support video clipboard paste."
          tabIndex={0}
        >
          <FiInfo aria-hidden="true" className="h-4 w-4 text-base-content/60" />
        </span>
      </div>
    </div>
  );
}

export type { MediaDetailCopyState };
export { MediaDetailPageActions };
