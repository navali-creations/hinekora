import { Link, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { Fragment } from "react";
import { FiBookmark, FiRotateCcw } from "react-icons/fi";
import { HiViewGrid } from "react-icons/hi";
import { IoIosRecording } from "react-icons/io";
import { MdMovieEdit, MdVideoLibrary } from "react-icons/md";
import { PiFilmSlate, PiVideo } from "react-icons/pi";

const navItems = [
  {
    to: "/",
    label: "Dashboard",
    icon: PiVideo,
    match: undefined,
    dividerAfter: true,
  },
  {
    to: "/clips",
    label: "Clips",
    icon: PiFilmSlate,
    match: undefined,
    dividerAfter: false,
  },
  {
    to: "/recordings",
    label: "Recordings",
    icon: IoIosRecording,
    match: undefined,
    dividerAfter: false,
  },
  {
    to: "/rewinds",
    label: "Rewinds",
    icon: FiRotateCcw,
    match: "/rewind/",
    dividerAfter: false,
  },
  {
    to: "/bookmarks",
    label: "Bookmarks",
    icon: FiBookmark,
    match: undefined,
    dividerAfter: true,
  },
  {
    to: "/crop-overlay",
    label: "Aura Manager",
    icon: HiViewGrid,
    match: undefined,
    dividerAfter: true,
  },
  {
    to: "/editor",
    label: "Editor",
    icon: MdMovieEdit,
    match: undefined,
    dividerAfter: false,
  },
  {
    to: "/saved-edits",
    label: "Saved Edits",
    icon: MdVideoLibrary,
    match: undefined,
    dividerAfter: false,
  },
] as const;

function SidebarNav() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  return (
    <nav aria-label="Main navigation" className="p-3">
      <ul className="menu menu-sm gap-1 p-0">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive =
            pathname === item.to ||
            Boolean(item.match && pathname.startsWith(item.match));

          return (
            <Fragment key={item.to}>
              <li>
                <Link
                  aria-current={isActive ? "page" : undefined}
                  className={clsx(
                    "[&.active]:bg-primary/10 [&.active]:text-base-content",
                    isActive && "active",
                  )}
                  data-status={isActive ? "active" : undefined}
                  to={item.to}
                >
                  <Icon size={20} />
                  <span className="font-medium">{item.label}</span>
                </Link>
              </li>
              {item.dividerAfter && (
                <li
                  aria-hidden="true"
                  className="pointer-events-none mx-2 my-1 h-0 border-base-content/25 border-t p-0"
                />
              )}
            </Fragment>
          );
        })}
      </ul>
    </nav>
  );
}

export { SidebarNav };
