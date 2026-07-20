import { AnimatePresence, motion } from "motion/react";

import { useManagedRecorderSelector } from "~/renderer/store";

import { EditorExportCancelConfirmationModal } from "../../editor/Editor.components/EditorExportCancelConfirmationModal/EditorExportCancelConfirmationModal";
import { EditorExportStatus } from "../Sidebar.components/EditorExportStatus/EditorExportStatus";
import { RecordingStatus } from "../Sidebar.components/RecordingStatus/RecordingStatus";
import { SidebarNav } from "../Sidebar.components/SidebarNav/SidebarNav";

const SESSION_STATUS_HEIGHT = 133;

function Sidebar() {
  const isRecording = useManagedRecorderSelector(
    (managedRecorder) => managedRecorder.status?.recording === true,
  );

  return (
    <aside className="no-drag relative z-10 flex h-full min-h-0 w-[160px] flex-col border-r border-base-100 shadow-[0_0_10px_black]">
      <AnimatePresence initial={false}>
        <motion.div
          animate={{ y: isRecording ? 0 : -SESSION_STATUS_HEIGHT }}
          className="relative"
          exit={{ y: -SESSION_STATUS_HEIGHT }}
          initial={{ y: -SESSION_STATUS_HEIGHT }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <RecordingStatus />
        </motion.div>
      </AnimatePresence>

      <motion.div
        animate={{ y: isRecording ? 0 : -SESSION_STATUS_HEIGHT }}
        className="flex h-full flex-col"
        exit={{ y: 0 }}
        initial={{ y: 0 }}
        transition={{ duration: 0.3, ease: "easeInOut" }}
      >
        <SidebarNav />
      </motion.div>
      <EditorExportStatus />
      <EditorExportCancelConfirmationModal />
    </aside>
  );
}

export { Sidebar };
