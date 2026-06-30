import { FiCopy, FiMinus, FiSquare, FiX } from "react-icons/fi";

import { useAppMenuShallow } from "~/renderer/store";

import { appbarButtonClass } from "../AppMenu.utils";

const windowIconSize = 12;
const closeIconSize = 16;

function AppWindowControls() {
  const { close, isMaximized, maximize, minimize, unmaximize } =
    useAppMenuShallow((appMenu) => ({
      close: appMenu.close,
      isMaximized: appMenu.isMaximized,
      maximize: appMenu.maximize,
      minimize: appMenu.minimize,
      unmaximize: appMenu.unmaximize,
    }));

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

  return (
    <>
      <button
        type="button"
        className={appbarButtonClass}
        onClick={handleMinimize}
        title="Minimize"
      >
        <FiMinus size={windowIconSize} />
      </button>
      {isMaximized ? (
        <button
          type="button"
          className={appbarButtonClass}
          onClick={handleUnmaximize}
          title="Restore"
        >
          <FiCopy size={windowIconSize} className="scale-x-[-1]" />
        </button>
      ) : (
        <button
          type="button"
          className={appbarButtonClass}
          onClick={handleMaximize}
          title="Maximize"
        >
          <FiSquare size={windowIconSize} />
        </button>
      )}
      <button
        type="button"
        className={appbarButtonClass}
        onClick={handleClose}
        title="Close"
      >
        <FiX size={closeIconSize} />
      </button>
    </>
  );
}

export { AppWindowControls };
