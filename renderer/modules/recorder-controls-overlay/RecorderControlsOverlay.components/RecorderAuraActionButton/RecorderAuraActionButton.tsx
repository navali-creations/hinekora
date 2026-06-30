import clsx from "clsx";
import type { MouseEventHandler } from "react";
import type { IconType } from "react-icons";

import styles from "../../RecorderControlsOverlay.page/RecorderControlsOverlayPage.module.css";

interface RecorderAuraActionButtonProps {
  ariaLabel: string;
  disabled: boolean;
  icon: IconType;
  iconClassName?: string;
  label: string;
  title: string;
  variant?: "edit" | "primary";
  onClick: MouseEventHandler<HTMLButtonElement>;
}

function RecorderAuraActionButton({
  ariaLabel,
  disabled,
  icon: Icon,
  iconClassName,
  label,
  title,
  variant = "primary",
  onClick,
}: RecorderAuraActionButtonProps) {
  return (
    <button
      aria-label={ariaLabel}
      className={clsx(
        styles.auraActionButton,
        "btn flex-col justify-center gap-px p-px text-center text-[0.5625rem] leading-[1.05] whitespace-normal",
        variant === "edit"
          ? "border-emerald-400/55 bg-emerald-500/90 text-neutral hover:bg-emerald-400 disabled:border-base-content/20 disabled:bg-base-300 disabled:text-base-content"
          : "btn-primary",
      )}
      disabled={disabled}
      title={title}
      type="button"
      onClick={onClick}
    >
      <Icon className={clsx("shrink-0", iconClassName)} size={15} />
      <span className="block max-w-full">{label}</span>
    </button>
  );
}

export { RecorderAuraActionButton };
