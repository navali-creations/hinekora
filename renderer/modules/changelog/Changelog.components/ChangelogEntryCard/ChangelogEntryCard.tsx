import type { ReactNode } from "react";
import { FiGitCommit, FiShield, FiUser } from "react-icons/fi";

import type { ChangelogEntry } from "~/main/modules/updater/Updater.api";
import { Badge } from "~/renderer/components/Badge/Badge";
import { MarkdownRenderer } from "~/renderer/components/MarkdownRenderer/MarkdownRenderer";
import { CORE_MAINTAINERS } from "~/renderer/modules/changelog/Changelog.utils/Changelog.utils";

import ChangelogContent from "../ChangelogContent/ChangelogContent";

interface ChangelogEntryCardProps {
  entry: ChangelogEntry;
}

function ChangelogEntryCard({ entry }: ChangelogEntryCardProps) {
  const isMaintainer =
    entry.contributor !== undefined && CORE_MAINTAINERS.has(entry.contributor);
  const contributorIcon: ReactNode = isMaintainer ? (
    <FiShield size={11} />
  ) : (
    <FiUser size={11} />
  );

  return (
    <div className="space-y-3">
      {entry.description && (
        <MarkdownRenderer>{entry.description}</MarkdownRenderer>
      )}

      {entry.content && <ChangelogContent content={entry.content} />}

      {entry.subItems && entry.subItems.length > 0 && (
        <MarkdownRenderer>
          {entry.subItems.map((item) => `- ${item}`).join("\n")}
        </MarkdownRenderer>
      )}

      {(entry.commitHash || entry.contributor) && (
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-4">
          {entry.commitHash && (
            <Badge
              variant="info"
              size="sm"
              soft
              icon={<FiGitCommit size={11} />}
            >
              {entry.commitUrl ? (
                <a
                  href={entry.commitUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  {entry.commitHash.slice(0, 7)}
                </a>
              ) : (
                entry.commitHash.slice(0, 7)
              )}
            </Badge>
          )}
          {entry.contributor && (
            <Badge
              variant={isMaintainer ? "success" : "info"}
              size="sm"
              soft
              icon={contributorIcon}
            >
              {entry.contributorUrl ? (
                <a
                  href={entry.contributorUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline"
                >
                  @{entry.contributor}
                </a>
              ) : (
                `@${entry.contributor}`
              )}
              {isMaintainer && (
                <span className="opacity-60"> - core maintainer</span>
              )}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}

export default ChangelogEntryCard;
