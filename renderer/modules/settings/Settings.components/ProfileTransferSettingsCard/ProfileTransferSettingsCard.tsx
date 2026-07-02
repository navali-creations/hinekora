import { FiDownload as Download, FiUpload as Upload } from "react-icons/fi";

import { useStateTransferShallow } from "~/renderer/store";

function ProfileTransferSettingsCard() {
  const {
    exportPortable,
    importPortable,
    lastMessage,
    preview,
    previewImport,
  } = useStateTransferShallow((stateTransfer) => ({
    exportPortable: stateTransfer.exportPortable,
    importPortable: stateTransfer.importPortable,
    lastMessage: stateTransfer.lastMessage,
    preview: stateTransfer.preview,
    previewImport: stateTransfer.previewImport,
  }));

  const handleExport = () => void exportPortable();
  const handlePreview = () => void previewImport();
  const handleMerge = () => void importPortable("merge");
  const handleReplace = () => void importPortable("replace");

  return (
    <section className="col-span-12 grid gap-3 rounded-lg border border-base-content/10 bg-neutral p-3 shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <h2 className="m-0 font-bold text-primary text-sm">
          Profile Export / Import
        </h2>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handleExport}
        >
          <Download size={16} />
          Export profiles
        </button>
        <button
          className="btn btn-primary btn-sm"
          type="button"
          onClick={handlePreview}
        >
          <Upload size={16} />
          Choose backup
        </button>
      </div>
      {preview && (
        <div className="grid grid-cols-2 items-center gap-2">
          <span>{preview.captureProfileCount} capture profiles</span>
          <span>{preview.profileCount} aura profiles</span>
          <span>{preview.replayClipCount} clips</span>
          <span>{preview.settingsIncluded ? "Settings included" : null}</span>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={handleMerge}
          >
            Add to current profiles
          </button>
          <button
            className="btn btn-primary btn-sm"
            type="button"
            onClick={handleReplace}
          >
            Replace profiles
          </button>
        </div>
      )}
      <p className="m-0 text-base-content/60">
        {lastMessage ??
          "Exports capture profiles, aura profiles, app setup, and clip history. Video files stay in your media folder."}
      </p>
    </section>
  );
}

export { ProfileTransferSettingsCard };
