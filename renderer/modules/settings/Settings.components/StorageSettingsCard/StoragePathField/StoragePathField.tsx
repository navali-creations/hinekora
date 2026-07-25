import { type ChangeEvent, type FocusEventHandler, useId } from "react";
import { FiFolder as FolderOpen } from "react-icons/fi";

interface StoragePathFieldProps {
  description: string;
  disabled: boolean;
  label: string;
  placeholder: string;
  value: string;
  onBlur: FocusEventHandler<HTMLInputElement>;
  onBrowse: () => void;
  onChange: (event: ChangeEvent<HTMLInputElement>) => void;
}

function StoragePathField({
  description,
  disabled,
  label,
  placeholder,
  value,
  onBlur,
  onBrowse,
  onChange,
}: StoragePathFieldProps) {
  const inputId = useId();

  return (
    <div className="grid min-w-0 gap-1.5 text-primary text-[0.8125rem]">
      <label htmlFor={inputId}>{label}</label>
      <div className="join w-full">
        <input
          id={inputId}
          className="input input-bordered input-sm join-item min-w-0 flex-1"
          disabled={disabled}
          placeholder={placeholder}
          value={value}
          onBlur={onBlur}
          onChange={onChange}
        />
        <button
          className="no-drag btn btn-primary btn-sm btn-square join-item"
          disabled={disabled}
          title={`Select ${label.toLowerCase()}`}
          type="button"
          onClick={onBrowse}
        >
          <FolderOpen size={16} />
        </button>
      </div>
      <span className="text-base-content/55 text-xs">{description}</span>
    </div>
  );
}

export { StoragePathField };
