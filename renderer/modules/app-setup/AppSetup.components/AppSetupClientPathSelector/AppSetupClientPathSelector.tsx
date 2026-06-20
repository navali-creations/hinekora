import { FiCheck, FiFolder } from "react-icons/fi";

interface AppSetupClientPathSelectorProps {
  label: string;
  currentPath: string;
  onSelectPath: () => void;
}

function AppSetupClientPathSelector({
  label,
  currentPath,
  onSelectPath,
}: AppSetupClientPathSelectorProps) {
  const hasPath = currentPath.length > 0;
  const selectLabel = `Select ${label}`;

  return (
    <div className="mb-3">
      <label className="label py-1">
        <span className="label-text text-sm text-base-content">{label}</span>
        {hasPath ? (
          <span
            aria-label="Selected"
            className="inline-flex items-center text-success text-xs"
            title="Selected"
          >
            <FiCheck className="h-3 w-3" />
          </span>
        ) : (
          <span className="text-xs text-warning">Required</span>
        )}
      </label>
      <div className="flex gap-2">
        <input
          className={`input input-bordered input-sm flex-1 text-xs ${
            hasPath ? "input-success" : "input-warning"
          }`}
          placeholder="No file selected"
          readOnly
          type="text"
          value={currentPath}
        />
        <button
          aria-label={selectLabel}
          className="btn btn-primary btn-square btn-sm"
          title={selectLabel}
          type="button"
          onClick={onSelectPath}
        >
          <FiFolder className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export default AppSetupClientPathSelector;
