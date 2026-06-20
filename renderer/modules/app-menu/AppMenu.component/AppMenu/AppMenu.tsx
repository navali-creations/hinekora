import { GameSelector } from "~/renderer/modules/game/GameSelector/GameSelector";

import AppControls from "../AppControls/AppControls";
import AppTitle from "../AppTitle/AppTitle";

const AppMenu = () => {
  return (
    <div className="flex drag justify-between items-center px-2 relative z-30 shadow-[160px_0_10px_black] before:content-[''] before:absolute before:bottom-0 before:left-[159px] before:right-0 before:h-px before:bg-base-100">
      <div className="flex gap-2 items-center">
        <AppTitle />
        <GameSelector />
      </div>

      <AppControls />
    </div>
  );
};

export default AppMenu;
