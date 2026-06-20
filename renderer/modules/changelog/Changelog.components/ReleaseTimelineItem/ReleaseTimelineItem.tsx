import type { KeyboardEvent, MouseEvent } from "react";

import type { ChangelogRelease } from "~/main/modules/updater/Updater.api";
import { Badge } from "~/renderer/components/Badge/Badge";

import {
  changeTypeColor,
  hoverBorderColorClass,
  releaseUrl,
} from "../../Changelog.utils/Changelog.utils";
import ChangelogEntryCard from "../ChangelogEntryCard/ChangelogEntryCard";

interface ReleaseTimelineItemProps {
  release: ChangelogRelease;
  isLast: boolean;
  isCurrent: boolean;
}

function ReleaseTimelineItem({
  release,
  isLast,
  isCurrent,
}: ReleaseTimelineItemProps) {
  const color = changeTypeColor(release.changeType);
  const url = releaseUrl(release.version);

  const handleCardClick = (event: MouseEvent<HTMLDivElement>) => {
    if ((event.target as HTMLElement).closest("a")) {
      return;
    }

    window.open(url, "_blank");
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    event.preventDefault();
    window.open(url, "_blank");
  };

  return (
    <li className="relative flex gap-6">
      <div className="flex flex-col items-center">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <Badge
            variant={color}
            size="md"
            outline
            className="shrink-0 font-mono font-semibold transition-all hover:brightness-125"
          >
            v{release.version}
          </Badge>
        </a>
        {isCurrent && (
          <Badge
            variant="success"
            size="sm"
            soft
            className="mt-1.5 text-[10px] uppercase tracking-wider"
          >
            current
          </Badge>
        )}
        {!isLast && <div className="mt-2 w-0.5 grow bg-base-content/10" />}
      </div>

      <div
        role="link"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={handleCardKeyDown}
        className={`card mb-6 min-w-0 flex-1 cursor-pointer border-2 border-transparent bg-base-200 shadow-sm transition-all hover:shadow-md hover:brightness-105 ${hoverBorderColorClass(
          color,
        )}`}
      >
        <div className="card-body gap-4 p-5">
          <ul className="space-y-4 divide-y divide-base-content/5">
            {release.entries.map((entry, entryIndex) => (
              <li key={`${release.version}-${entryIndex}`}>
                <ChangelogEntryCard entry={entry} />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </li>
  );
}

export default ReleaseTimelineItem;
