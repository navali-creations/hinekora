import { Link } from "@tanstack/react-router";
import { type MouseEvent, useRef } from "react";
import { FiEdit3, FiFolder, FiMoreHorizontal, FiTrash2 } from "react-icons/fi";

import type { RunRecordingDetail } from "~/main/modules/recording-storage";
import { PageBackButton } from "~/renderer/components/PageBackButton/PageBackButton";

interface RecordingDetailPageActionsProps {
  canOpenLocation: boolean;
  recording: RunRecordingDetail["recording"] | null;
  onDeleteRecording: () => void;
  onOpenLocation: () => void;
}

function RecordingDetailPageActions({
  canOpenLocation,
  recording,
  onDeleteRecording,
  onOpenLocation,
}: RecordingDetailPageActionsProps) {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const canDeleteRecording = recording !== null;

  const handleMenuClick = (event: MouseEvent<HTMLUListElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("button") instanceof HTMLButtonElement
    ) {
      detailsRef.current?.removeAttribute("open");
    }
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      <PageBackButton fallbackTo="/recordings" />
      {recording && (
        <Link
          className="btn btn-primary btn-sm no-drag"
          search={{ id: recording.id, kind: "recording" }}
          to="/editor"
        >
          <FiEdit3 size={15} />
          Edit
        </Link>
      )}
      <details className="dropdown dropdown-end no-drag" ref={detailsRef}>
        <summary
          aria-label="More recording actions"
          className="btn btn-primary btn-sm list-none [&::-webkit-details-marker]:hidden"
        >
          <FiMoreHorizontal size={17} />
        </summary>
        <ul
          className="dropdown-content z-50 mt-1 grid w-56 list-none gap-1 rounded-box border border-base-content/10 bg-base-200 p-2 shadow-lg"
          onClick={handleMenuClick}
        >
          <li className="list-none">
            <button
              className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-sm transition-colors hover:bg-base-300 disabled:cursor-not-allowed disabled:opacity-45"
              disabled={!canOpenLocation}
              type="button"
              onClick={onOpenLocation}
            >
              Open location
              <FiFolder size={14} />
            </button>
          </li>
          <li aria-hidden="true" className="list-none py-1">
            <div className="h-px w-full bg-base-content/10" />
          </li>
          <li className="list-none">
            <button
              className="flex h-8 w-full cursor-pointer items-center justify-between gap-3 rounded-md px-3 text-left text-red-400 text-sm transition-colors hover:bg-red-500/10 disabled:cursor-not-allowed disabled:text-red-400/55 disabled:opacity-100"
              disabled={!canDeleteRecording}
              type="button"
              onClick={onDeleteRecording}
            >
              Delete recording
              <FiTrash2 size={14} />
            </button>
          </li>
        </ul>
      </details>
    </div>
  );
}

export { RecordingDetailPageActions };
