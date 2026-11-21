import clsx from "clsx";
import type { MouseEvent } from "react";
import { useCallback } from "react";

import { useAppMenuShallow } from "~/renderer/store";

const selectedReleaseTabClass =
  "bg-[#f5e6c8]/15 text-[#f5e6c8] shadow-[inset_0_0_0_1px_rgba(245,230,200,0.65),0_0_18px_rgba(245,230,200,0.18)]";
const idleReleaseTabClass =
  "text-[#f5e6c8]/60 hover:bg-[#f5e6c8]/10 hover:text-[#f5e6c8]";

export const WhatsNewReleaseTabs = () => {
  const { whatsNewReleases, whatsNewSelectedVersion, selectWhatsNewRelease } =
    useAppMenuShallow((appMenu) => ({
      whatsNewReleases: appMenu.whatsNewReleases,
      whatsNewSelectedVersion: appMenu.whatsNewSelectedVersion,
      selectWhatsNewRelease: appMenu.selectWhatsNewRelease,
    }));

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
      className="inline-flex min-w-0 items-center gap-1 overflow-x-auto rounded-full border border-[#f5e6c8]/20 bg-[#f5e6c8]/5 p-0.5"
      role="tablist"
      aria-label="Release versions"
    >
      {whatsNewReleases.toReversed().map((release) => {
        const isSelected = release.version === whatsNewSelectedVersion;

        return (
          <button
            key={release.version}
            type="button"
            role="tab"
            aria-selected={isSelected}
            value={release.version}
            className={clsx(
              "btn btn-ghost btn-xs h-6 min-h-0 shrink-0 rounded-full border-0 px-2 font-mono text-xs font-medium normal-case tabular-nums",
              isSelected ? selectedReleaseTabClass : idleReleaseTabClass,
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
