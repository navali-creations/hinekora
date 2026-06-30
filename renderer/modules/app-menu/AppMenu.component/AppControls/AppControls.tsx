import UpdateIndicator from "~/renderer/modules/updater/UpdateIndicator/UpdateIndicator";

import { AppHelpMenu } from "../AppHelpMenu/AppHelpMenu";
import { AppRecorderOverlayToggle } from "../AppRecorderOverlayToggle/AppRecorderOverlayToggle";
import { AppWindowControls } from "../AppWindowControls/AppWindowControls";
import DiskSpaceWarning from "../DiskSpaceWarning/DiskSpaceWarning";
import WhatsNewModal from "../WhatsNewModal/WhatsNewModal";

const AppControls = () => {
  return (
    <div className="flex gap-0">
      <UpdateIndicator />
      <DiskSpaceWarning />
      <AppRecorderOverlayToggle />
      <AppHelpMenu />
      <AppWindowControls />
      <WhatsNewModal />
    </div>
  );
};

export default AppControls;
