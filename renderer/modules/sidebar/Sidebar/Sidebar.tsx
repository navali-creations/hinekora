import { motion } from "motion/react";

import { useManagedRecorderSelector } from "~/renderer/store";

import { EditorExportCancelConfirmationModal } from "../../editor/Editor.components/EditorExportCancelConfirmationModal/EditorExportCancelConfirmationModal";
import { EditorExportStatus } from "../Sidebar.components/EditorExportStatus/EditorExportStatus";
import { RecordingStatus } from "../Sidebar.components/RecordingStatus/RecordingStatus";
import { SidebarNav } from "../Sidebar.components/SidebarNav/SidebarNav";
import { SidebarStorageUsage } from "../Sidebar.components/SidebarStorageUsage/SidebarStorageUsage";

const SESSION_STATUS_HEIGHT = 133;

function Sidebar() {
  const isRecording = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status?.recording === true,
  );

  return (
    <aside className="no-drag relative z-10 flex h-full min-h-0 w-[160px] flex-col border-r border-base-100 shadow-[0_0_10px_black]">
      <motion.div
        animate={{ height: isRecording ? SESSION_STATUS_HEIGHT : 0 }}
        aria-hidden={!isRecording}
        className="shrink-0 overflow-hidden"
        initial={false}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <RecordingStatus />
      </motion.div>

      <div className="flex min-h-0 flex-1 flex-col">
        <SidebarNav />
        <div className="mt-auto grid shrink-0 gap-2 p-3 pt-2">
          <EditorExportStatus />
          <SidebarStorageUsage />
        </div>
      </div>
      <EditorExportCancelConfirmationModal />
    </aside>
  );
}

export { Sidebar };
