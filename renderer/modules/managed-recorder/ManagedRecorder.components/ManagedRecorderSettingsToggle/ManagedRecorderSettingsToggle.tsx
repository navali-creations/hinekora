import type { ChangeEvent } from "react";
import { useId } from "react";
import { FiInfo } from "react-icons/fi";

interface ManagedRecorderSettingsToggleProps {
  ariaLabel: string;
  checked: boolean;
  helpText: string;
  label: string;
  onChange: (checked: boolean) => void;
}

function ManagedRecorderSettingsToggle({
  ariaLabel,
  checked,
  helpText,
  label,
  onChange,
}: ManagedRecorderSettingsToggleProps) {
  const inputId = useId();
  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.checked);
  };

  return (
    <div className="flex min-w-0 items-center justify-between gap-3 py-1 text-primary text-[0.8125rem]">
      <span className="inline-flex min-w-0 items-center gap-1">
        <label className="font-semibold" htmlFor={inputId}>
          {label}
        </label>
        <button
          aria-label={helpText}
          className="tooltip tooltip-bottom inline-flex cursor-help border-0 bg-transparent p-0 text-base-content/45 transition-colors hover:text-base-content/70"
          data-tip={helpText}
          type="button"
        >
          <FiInfo className="h-3.5 w-3.5" />
        </button>
      </span>
      <input
        aria-label={ariaLabel}
        checked={checked}
        className="toggle toggle-primary toggle-xs shrink-0"
        id={inputId}
        type="checkbox"
        onChange={handleChange}
      />
    </div>
  );
}

export { ManagedRecorderSettingsToggle };
