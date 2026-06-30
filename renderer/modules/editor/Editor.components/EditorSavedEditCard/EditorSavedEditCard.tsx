import { useNavigate } from "@tanstack/react-router";
import { MdVideoLibrary } from "react-icons/md";

import type { SavedEditItem } from "~/main/modules/saved-edits";
import {
  formatDateTime,
  formatDurationSeconds,
} from "~/renderer/modules/media-library/MediaLibrary.utils/MediaLibrary.utils";

interface EditorSavedEditCardProps {
  edit: SavedEditItem;
}

function EditorSavedEditCard({ edit }: EditorSavedEditCardProps) {
  const navigate = useNavigate();

  const handleOpenEdit = () => {
    void navigate({
      to: "/editor",
      search: { projectId: edit.id },
    });
  };

  return (
    <div className="flex w-full items-stretch gap-1 rounded-lg border border-base-content/10 bg-base-300/55 p-2 text-left transition hover:border-primary/50 hover:bg-base-content/[0.03]">
      <button
        className="min-w-0 flex-1 text-left focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
        type="button"
        onClick={handleOpenEdit}
      >
        <span className="flex items-start gap-2">
          <span className="mt-0.5 rounded bg-base-100 p-1.5 text-primary">
            <MdVideoLibrary size={15} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-semibold text-sm">
              {edit.title}
            </span>
            <span className="mt-1 flex items-center justify-between gap-2 text-[11px] text-base-content/45">
              <span>{formatDateTime(edit.updatedAt)}</span>
              <span>
                {edit.clipCount} clips -{" "}
                {formatDurationSeconds(edit.durationSeconds)}
              </span>
            </span>
          </span>
        </span>
      </button>
    </div>
  );
}

export { EditorSavedEditCard };
