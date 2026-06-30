import { Link } from "@tanstack/react-router";
import { type MouseEvent, useRef } from "react";
import { FiGithub, FiHeart, FiHelpCircle, FiSettings } from "react-icons/fi";
import { IoNewspaperOutline } from "react-icons/io5";
import { MdOutlineNewReleases } from "react-icons/md";
import { RiDiscordLine } from "react-icons/ri";

import { useAppMenuShallow } from "~/renderer/store";

import { HINEKORA_DISCORD_URL, HINEKORA_GITHUB_URL } from "~/types";
import { appbarButtonClass } from "../AppMenu.utils";

const menuIconSize = 18;
const menuSeparatorClass =
  "divider my-1 h-px min-h-px shrink-0 px-0 before:h-px after:h-px";

function AppHelpMenu() {
  const detailsRef = useRef<HTMLDetailsElement>(null);
  const openWhatsNew = useAppMenuShallow((appMenu) => appMenu.openWhatsNew);

  const handleOpenWhatsNew = () => {
    void openWhatsNew();
  };

  const handleMenuClick = (event: MouseEvent<HTMLUListElement>) => {
    if (
      event.target instanceof Element &&
      event.target.closest("a, button") !== null
    ) {
      detailsRef.current?.removeAttribute("open");
    }
  };

  return (
    <details className="dropdown dropdown-end" ref={detailsRef}>
      <summary aria-label="More options" className={appbarButtonClass}>
        <FiHelpCircle size={menuIconSize} />
      </summary>
      <ul
        className="menu dropdown-content z-50 mt-1 w-[180px] rounded-box border border-base-300 bg-base-200 p-2 shadow-lg"
        onClick={handleMenuClick}
      >
        <li>
          <Link
            to="/settings"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-300 no-drag"
          >
            <span className="text-sm">Settings</span>
            <FiSettings size={14} className="text-base-content/60" />
          </Link>
        </li>

        <li className={menuSeparatorClass} role="separator" />

        <li>
          <button
            type="button"
            className="flex w-full items-center justify-between gap-3 rounded-lg px-3 py-2 text-left transition-colors hover:bg-base-300 no-drag"
            onClick={handleOpenWhatsNew}
          >
            <span className="text-sm">What&apos;s New</span>
            <MdOutlineNewReleases size={15} className="text-base-content/60" />
          </button>
        </li>
        <li>
          <Link
            to="/changelog"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-300 no-drag"
          >
            <span className="text-sm">Changelog</span>
            <IoNewspaperOutline size={14} className="text-base-content/60" />
          </Link>
        </li>

        <li className={menuSeparatorClass} role="separator" />

        <li>
          <a
            href={HINEKORA_GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-300 no-drag"
          >
            <span className="text-sm">View Source</span>
            <FiGithub size={14} className="text-base-content/60" />
          </a>
        </li>
        <li>
          <a
            href={HINEKORA_DISCORD_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-300 no-drag"
          >
            <span className="text-sm">Discord</span>
            <RiDiscordLine size={14} className="text-base-content/60" />
          </a>
        </li>

        <li className={menuSeparatorClass} role="separator" />

        <li>
          <Link
            to="/attributions"
            className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-base-300 no-drag"
          >
            <span className="text-sm">Attributions</span>
            <FiHeart size={14} className="text-base-content/60" />
          </Link>
        </li>
      </ul>
    </details>
  );
}

export { AppHelpMenu };
