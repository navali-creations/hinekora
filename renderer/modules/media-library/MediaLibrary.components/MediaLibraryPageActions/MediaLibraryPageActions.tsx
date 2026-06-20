import type { ChangeEvent, ReactNode } from "react";
import { FiRefreshCw as RefreshCw } from "react-icons/fi";

import type { MediaLibraryLeagueOption } from "../../MediaLibrary.utils/MediaLibrary.utils";

interface MediaLibraryPageActionsProps {
  bulkAction?: ReactNode;
  leadingAction?: ReactNode;
  league: string;
  leagueOptions: MediaLibraryLeagueOption[];
  onLeagueChange: (league: string) => void;
  onRefresh: () => void;
}

function MediaLibraryPageActions({
  bulkAction,
  leadingAction,
  league,
  leagueOptions,
  onLeagueChange,
  onRefresh,
}: MediaLibraryPageActionsProps) {
  const handleLeagueChange = (event: ChangeEvent<HTMLSelectElement>) => {
    onLeagueChange(event.target.value);
  };

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {leadingAction}

      <label className="no-drag">
        <span className="sr-only">Library league</span>
        <select
          className="select select-bordered select-sm h-8 w-44"
          value={league}
          onChange={handleLeagueChange}
        >
          {leagueOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </label>

      {bulkAction}

      <button
        className="btn btn-primary btn-sm no-drag"
        type="button"
        onClick={onRefresh}
      >
        <RefreshCw size={15} />
        Refresh
      </button>
    </div>
  );
}

export { MediaLibraryPageActions };
