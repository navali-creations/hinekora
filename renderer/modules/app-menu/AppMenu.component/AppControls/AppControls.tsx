import UpdateIndicator from "~/renderer/modules/updater/UpdateIndicator/UpdateIndicator";

import { AppHelpMenu } from "../AppHelpMenu/AppHelpMenu";
import { AppRecorderOverlayToggle } from "../AppRecorderOverlayToggle/AppRecorderOverlayToggle";
import { AppWindowControls } from "../AppWindowControls/AppWindowControls";
import WhatsNewModal from "../WhatsNewModal/WhatsNewModal";

const AppControls = () => {
  return (
    <div className="flex items-center gap-0">
      <UpdateIndicator />
      <AppRecorderOverlayToggle />
      <AppHelpMenu />
      <AppWindowControls />
      <WhatsNewModal />
    </div>
  );
};

export default AppControls;
