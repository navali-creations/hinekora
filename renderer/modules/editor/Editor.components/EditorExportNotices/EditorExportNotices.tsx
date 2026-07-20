import { NoticeAlert } from "~/renderer/components/NoticeAlert/NoticeAlert";
import { useEditorShallow } from "~/renderer/store";

function EditorExportNotices() {
  const { dismissExportNotice, dismissedNoticeIds } = useEditorShallow(
    (editor) => ({
      dismissExportNotice: editor.dismissExportNotice,
      dismissedNoticeIds: editor.exportState.dismissedNoticeIds,
    }),
  );
  const isKeepUsingVisible = !dismissedNoticeIds.includes(
    "keep-using-hinekora",
  );
  const isKeepEditingVisible = !dismissedNoticeIds.includes(
    "keep-editing-safely",
  );
  const isCancellationVisible = !dismissedNoticeIds.includes(
    "cancel-without-leftovers",
  );

  const handleDismissKeepUsing = () => {
    dismissExportNotice("keep-using-hinekora");
  };

  const handleDismissKeepEditing = () => {
    dismissExportNotice("keep-editing-safely");
  };

  const handleDismissCancellation = () => {
    dismissExportNotice("cancel-without-leftovers");
  };

  if (!isKeepUsingVisible && !isKeepEditingVisible && !isCancellationVisible) {
    return null;
  }

  return (
    <section aria-label="Video processing information" className="grid gap-2">
      {isKeepUsingVisible && (
        <NoticeAlert
          dismissLabel="Dismiss keep using Hinekora notice"
          title="Keep using Hinekora"
          onDismiss={handleDismissKeepUsing}
        >
          <p className="m-0">
            You can keep using Hinekora while this video saves. Return here
            anytime with <strong>View</strong> in the sidebar.
          </p>
        </NoticeAlert>
      )}
      {isKeepEditingVisible && (
        <NoticeAlert
          dismissLabel="Dismiss keep editing safely notice"
          title="Keep editing safely"
          onDismiss={handleDismissKeepEditing}
        >
          <p className="m-0">
            You can keep editing. Changes apply only to your next video; this
            save keeps the version you started with. Save and Copy to clipboard
            become available again when it finishes.
          </p>
        </NoticeAlert>
      )}
      {isCancellationVisible && (
        <NoticeAlert
          dismissLabel="Dismiss cancellation cleanup notice"
          title="Cancel without leftovers"
          onDismiss={handleDismissCancellation}
        >
          <p className="m-0">
            Cancel here or from the sidebar. The unfinished video is removed, so
            it leaves no extra saved file or library entry.
          </p>
        </NoticeAlert>
      )}
    </section>
  );
}

export { EditorExportNotices };
