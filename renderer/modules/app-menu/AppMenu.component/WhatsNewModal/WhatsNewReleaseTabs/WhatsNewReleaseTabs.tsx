import clsx from "clsx";
import type { MouseEvent } from "react";
import { useCallback } from "react";

import {
  type ChangeTypeColor,
  changeTypeColor,
} from "~/renderer/modules/changelog/Changelog.utils/Changelog.utils";
import { useAppMenu } from "~/renderer/store";

const releaseTabColorClasses: Record<
  ChangeTypeColor,
  { selected: string; idle: string }
> = {
  info: {
    selected:
      "bg-info/15 text-info shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-info)_45%,transparent)]",
    idle: "text-info/70 hover:bg-info/10 hover:text-info",
  },
  success: {
    selected:
      "bg-success/15 text-success shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-success)_45%,transparent)]",
    idle: "text-success/70 hover:bg-success/10 hover:text-success",
  },
  warning: {
    selected:
      "bg-warning/15 text-warning shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-warning)_45%,transparent)]",
    idle: "text-warning/70 hover:bg-warning/10 hover:text-warning",
  },
  accent: {
    selected:
      "bg-accent/15 text-accent shadow-[inset_0_0_0_1px_color-mix(in_oklab,var(--color-accent)_45%,transparent)]",
    idle: "text-accent/70 hover:bg-accent/10 hover:text-accent",
  },
};

export const WhatsNewReleaseTabs = () => {
  const { whatsNewReleases, whatsNewSelectedVersion, selectWhatsNewRelease } =
    useAppMenu();

  const handleTabClick = useCallback(
    (event: MouseEvent<HTMLButtonElement>) => {
      selectWhatsNewRelease(event.currentTarget.value);
    },
    [selectWhatsNewRelease],
  );

  if (whatsNewReleases.length === 0) {
    return null;
  }

  return (
    <div
      className="inline-flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-base-content/10 bg-base-200/55 p-0.5"
      role="tablist"
      aria-label="Release versions"
    >
      {whatsNewReleases.map((release) => {
        const isSelected = release.version === whatsNewSelectedVersion;
        const color = changeTypeColor(release.changeType);
        const colorClasses = releaseTabColorClasses[color];

        return (
          <button
            key={release.version}
            type="button"
            role="tab"
            aria-selected={isSelected}
            value={release.version}
            className={clsx(
              "btn btn-ghost btn-xs h-6 min-h-0 shrink-0 rounded-full border-0 px-2 font-mono text-xs font-medium normal-case tabular-nums",
              isSelected ? colorClasses.selected : colorClasses.idle,
            )}
            onClick={handleTabClick}
          >
            v{release.version}
          </button>
        );
      })}
    </div>
  );
};
