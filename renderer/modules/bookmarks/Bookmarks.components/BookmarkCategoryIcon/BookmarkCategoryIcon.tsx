import clsx from "clsx";
import type { IconType } from "react-icons";
import { FiBookmark, FiRotateCcw } from "react-icons/fi";
import {
  GiAbstract103,
  GiCrownedSkull,
  GiFleurDeLys,
  GiHastyGrave,
} from "react-icons/gi";
import { HiMiniHome } from "react-icons/hi2";

import type { BookmarkCategory } from "~/main/modules/bookmarks";
import {
  bookmarkCategoryIconClassNames,
  bookmarkCategoryLabels,
} from "~/renderer/modules/bookmarks/Bookmarks.utils";

interface BookmarkCategoryIconProps {
  category: BookmarkCategory;
  className?: string;
  colorClassName?: string;
  isDecorative?: boolean;
  size?: number;
}

const bookmarkCategoryIconComponents: Partial<
  Record<BookmarkCategory, IconType>
> = {
  boss: GiCrownedSkull,
  death: GiHastyGrave,
  hideout: GiFleurDeLys,
  manual: FiBookmark,
  map: GiAbstract103,
  "rewind-manual-replay": FiRotateCcw,
  town: HiMiniHome,
};

function BookmarkCategoryIcon({
  category,
  className,
  colorClassName,
  isDecorative = false,
  size = 18,
}: BookmarkCategoryIconProps) {
  const Icon = bookmarkCategoryIconComponents[category];
  const label = bookmarkCategoryLabels[category];
  const resolvedColorClassName =
    colorClassName ?? bookmarkCategoryIconClassNames[category];

  if (Icon) {
    return (
      <span
        aria-hidden={isDecorative || undefined}
        aria-label={isDecorative ? undefined : label}
        className={clsx(
          "inline-flex items-center justify-center",
          className ?? "h-5 w-5",
          resolvedColorClassName,
        )}
        role={isDecorative ? undefined : "img"}
        title={isDecorative ? undefined : label}
      >
        <Icon aria-hidden="true" size={size} />
      </span>
    );
  }

  return (
    <span
      aria-hidden={isDecorative || undefined}
      className={clsx("block", className ?? "h-5 w-5")}
      title={isDecorative ? undefined : label}
    />
  );
}

export { BookmarkCategoryIcon };
