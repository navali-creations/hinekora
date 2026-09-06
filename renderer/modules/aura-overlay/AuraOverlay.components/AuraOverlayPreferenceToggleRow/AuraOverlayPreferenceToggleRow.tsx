import clsx from "clsx";
import type { ChangeEventHandler } from "react";

interface AuraOverlayPreferenceToggleRowProps {
  ariaLabel: string;
  checked: boolean;
  className?: string;
  description: string;
  error: string | null;
  id: string;
  label: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
}

function AuraOverlayPreferenceToggleRow({
  ariaLabel,
  checked,
  className,
  description,
  error,
  id,
  label,
  onChange,
}: AuraOverlayPreferenceToggleRowProps) {
  return (
    <div className={clsx("grid gap-1 py-2", className)}>
      <div className="flex items-center justify-between gap-3">
        <label className="font-black text-base-content" htmlFor={id}>
          {label}
        </label>
        <input
          aria-label={ariaLabel}
          checked={checked}
          className="toggle toggle-primary toggle-xs shrink-0"
          id={id}
          type="checkbox"
          onChange={onChange}
        />
      </div>
      <p className="m-0 font-bold text-primary/75">{description}</p>
      {error && (
        <p className="m-0 font-bold text-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export { AuraOverlayPreferenceToggleRow };
