import { Link, useRouterState } from "@tanstack/react-router";
import clsx from "clsx";
import { HiViewGrid } from "react-icons/hi";
import { IoIosRecording } from "react-icons/io";
import { MdMovieEdit } from "react-icons/md";
import { PiFilmSlate, PiVideo } from "react-icons/pi";

const navItems = [
  { to: "/", label: "Dashboard", icon: PiVideo },
  { to: "/clips", label: "Clips", icon: PiFilmSlate },
  { to: "/recordings", label: "Recordings", icon: IoIosRecording },
  { to: "/crop-overlay", label: "Aura Manager", icon: HiViewGrid },
  { to: "/editor", label: "Editor", icon: MdMovieEdit },
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
          const isActive = pathname === item.to;

          return (
            <li key={item.to}>
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
          );
        })}
      </ul>
    </nav>
  );
}

export { SidebarNav };
