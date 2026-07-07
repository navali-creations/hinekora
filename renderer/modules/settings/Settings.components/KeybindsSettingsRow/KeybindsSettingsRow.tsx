import clsx from "clsx";
import type { MouseEvent } from "react";
import { FiRotateCcw, FiX } from "react-icons/fi";

import type { KeybindRegistrationStatusItem } from "~/main/modules/keybinds/Keybinds.dto";

import { Keybind, type KeybindAction, keybindActionConfigs } from "~/types";
import { resolveStatusText } from "../KeybindsSettingsCard/KeybindsSettingsCard.utils";

interface KeybindsSettingsRowProps {
  action: KeybindAction;
  activePreview: string;
  isActive: boolean;
  isDisabled: boolean;
  onClearClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onRecordClick: (event: MouseEvent<HTMLButtonElement>) => void;
  onResetClick: (event: MouseEvent<HTMLButtonElement>) => void;
  registrationStatus: KeybindRegistrationStatusItem | null;
  savedAccelerator: string | null;
}

function KeybindsSettingsRow({
  action,
  activePreview,
  isActive,
  isDisabled,
  onClearClick,
  onRecordClick,
  onResetClick,
  registrationStatus,
  savedAccelerator,
}: KeybindsSettingsRowProps) {
  const config = keybindActionConfigs[action];
  const savedKeybind = Keybind.tryParse(savedAccelerator);
  const displayLabel = isActive
    ? activePreview || "Press key"
    : (registrationStatus?.displayLabel ??
      savedKeybind?.toDisplayLabel() ??
      "No Keybind Set");
  const hasSavedAccelerator = savedAccelerator !== null;
  const isDefault =
    savedAccelerator === new Keybind(config.defaultAccelerator).toString();
  const statusText = resolveStatusText(registrationStatus?.error ?? null);

  return (
    <div className="grid gap-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)] lg:items-center">
      <div className="min-w-0">
        <h3 className="m-0 font-semibold text-base-content/85 text-sm">
          {config.label}
        </h3>
        <p className="m-0 text-base-content/50 text-xs">{config.description}</p>
        {statusText && (
          <p className="m-0 mt-1 text-error text-xs">{statusText}</p>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <div
          aria-live="polite"
          className={clsx(
            "input input-bordered input-sm flex min-w-0 flex-1 items-center overflow-hidden",
            {
              "border-error/70 bg-error/10 text-error": isActive || statusText,
              "text-base-content/40": !isActive && !hasSavedAccelerator,
            },
          )}
        >
          <span className="min-w-0 truncate font-semibold text-xs">
            {displayLabel}
          </span>
        </div>

        <button
          className={clsx("btn btn-sm shrink-0", {
            "btn-error": isActive,
            "btn-outline": !isActive,
          })}
          data-action={action}
          disabled={isDisabled}
          type="button"
          onClick={onRecordClick}
        >
          {isActive
            ? "Cancel"
            : hasSavedAccelerator
              ? "Edit Keybind"
              : "Record Keybind"}
        </button>

        <button
          aria-label={`Reset ${config.label} keybind`}
          className="btn btn-ghost btn-sm btn-square shrink-0"
          data-action={action}
          disabled={isDisabled || isDefault}
          title={`Reset ${config.label} keybind`}
          type="button"
          onClick={onResetClick}
        >
          <FiRotateCcw size={15} />
        </button>

        <button
          aria-label={`Clear ${config.label} keybind`}
          className="btn btn-ghost btn-sm btn-square shrink-0"
          data-action={action}
          disabled={isDisabled || !hasSavedAccelerator}
          title={`Clear ${config.label} keybind`}
          type="button"
          onClick={onClearClick}
        >
          <FiX size={16} />
        </button>
      </div>
    </div>
  );
}

export { KeybindsSettingsRow };
