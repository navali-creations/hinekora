import { Link } from "@tanstack/react-router";
import {
  FiCopy,
  FiGithub,
  FiHeart,
  FiMinus,
  FiSettings,
  FiSquare,
  FiX,
} from "react-icons/fi";
import { IoNewspaperOutline } from "react-icons/io5";
import { MdOutlineNewReleases } from "react-icons/md";
import {
  RiDiscordLine,
  RiPictureInPictureExitLine,
  RiPictureInPictureLine,
} from "react-icons/ri";
import { RxCaretDown } from "react-icons/rx";

import UpdateIndicator from "~/renderer/modules/updater/UpdateIndicator/UpdateIndicator";
import { useAppMenu } from "~/renderer/store";

import DiskSpaceWarning from "../DiskSpaceWarning/DiskSpaceWarning";
import WhatsNewModal from "../WhatsNewModal/WhatsNewModal";

const REPO_URL = "https://github.com/navali-creations/hinekora";
const DISCORD_URL = "https://discord.gg/mrqmPYXHHT";
const OVERLAY_ICON_SIZE = 16;
const MENU_ICON_SIZE = 18;
const WINDOW_ICON_SIZE = 12;
const CLOSE_ICON_SIZE = 16;
const APPBAR_BUTTON_CLASS = "no-drag btn btn-ghost btn-sm";

const AppControls = () => {
  const {
    minimize,
    maximize,
    unmaximize,
    close,
    isMaximized,
    isRecorderOverlayVisible,
    toggleRecorderOverlay,
    openWhatsNew,
  } = useAppMenu();

  const handleToggleRecorderOverlay = () => {
    void toggleRecorderOverlay();
  };

  const handleOpenWhatsNew = () => {
    void openWhatsNew();
  };

  const handleMinimize = () => {
    minimize();
  };

  const handleMaximize = () => {
    void maximize();
  };

  const handleUnmaximize = () => {
    void unmaximize();
  };

  const handleClose = () => {
    close();
  };
  const overlayTooltip = isRecorderOverlayVisible
    ? "Hide Overlay"
    : "Show Overlay";

  return (
    <div className="flex gap-0">
      <UpdateIndicator />
      <DiskSpaceWarning />
      <div className="tooltip tooltip-bottom" data-tip={overlayTooltip}>
        <button
          type="button"
          className={APPBAR_BUTTON_CLASS}
          data-onboarding="overlay-icon"
          aria-pressed={isRecorderOverlayVisible}
          title={overlayTooltip}
          onClick={handleToggleRecorderOverlay}
        >
          {isRecorderOverlayVisible ? (
            <RiPictureInPictureExitLine size={OVERLAY_ICON_SIZE} />
          ) : (
            <RiPictureInPictureLine size={OVERLAY_ICON_SIZE} />
          )}
        </button>
      </div>
      <details className="dropdown dropdown-end">
        <summary className={APPBAR_BUTTON_CLASS}>
          <RxCaretDown size={MENU_ICON_SIZE} />
        </summary>
        <ul className="menu dropdown-content z-50 mt-1 w-[180px] rounded-box border border-base-300 bg-base-200 p-2 shadow-lg">
          <li>
            <Link
              to="/settings"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
            >
              <span className="text-sm">Settings</span>
              <FiSettings size={14} className="text-base-content/60" />
            </Link>
          </li>

          <div className="divider my-0 px-2" />

          <li>
            <button
              type="button"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors w-full text-left no-drag"
              onClick={handleOpenWhatsNew}
            >
              <span className="text-sm">What&apos;s New</span>
              <MdOutlineNewReleases
                size={15}
                className="text-base-content/60"
              />
            </button>
          </li>
          <li>
            <Link
              to="/changelog"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
            >
              <span className="text-sm">Changelog</span>
              <IoNewspaperOutline size={14} className="text-base-content/60" />
            </Link>
          </li>

          <div className="divider my-0 px-2" />

          <li>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
            >
              <span className="text-sm">View Source</span>
              <FiGithub size={14} className="text-base-content/60" />
            </a>
          </li>
          <li>
            <a
              href={DISCORD_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
            >
              <span className="text-sm">Discord</span>
              <RiDiscordLine size={14} className="text-base-content/60" />
            </a>
          </li>

          <div className="divider my-0 px-2" />

          <li>
            <Link
              to="/attributions"
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg hover:bg-base-300 transition-colors no-drag"
            >
              <span className="text-sm">Attributions</span>
              <FiHeart size={14} className="text-base-content/60" />
            </Link>
          </li>
        </ul>
      </details>
      <button
        type="button"
        className={APPBAR_BUTTON_CLASS}
        onClick={handleMinimize}
        title="Minimize"
      >
        <FiMinus size={WINDOW_ICON_SIZE} />
      </button>
      {isMaximized ? (
        <button
          type="button"
          className={APPBAR_BUTTON_CLASS}
          onClick={handleUnmaximize}
          title="Restore"
        >
          <FiCopy size={WINDOW_ICON_SIZE} className="scale-x-[-1]" />
        </button>
      ) : (
        <button
          type="button"
          className={APPBAR_BUTTON_CLASS}
          onClick={handleMaximize}
          title="Maximize"
        >
          <FiSquare size={WINDOW_ICON_SIZE} />
        </button>
      )}
      <button
        type="button"
        className={APPBAR_BUTTON_CLASS}
        onClick={handleClose}
        title="Close"
      >
        <FiX size={CLOSE_ICON_SIZE} />
      </button>

      <WhatsNewModal />
    </div>
  );
};

export default AppControls;
