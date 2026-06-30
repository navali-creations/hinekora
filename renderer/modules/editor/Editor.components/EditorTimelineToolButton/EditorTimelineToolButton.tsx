import clsx from "clsx";
import type { FocusEventHandler, MouseEventHandler } from "react";
import type { IconType } from "react-icons";

interface EditorTimelineToolButtonProps {
  ariaLabel: string;
  ariaPressed?: boolean;
  className?: string;
  disabled?: boolean;
  icon: IconType;
  tooltip: string;
  onBlur?: FocusEventHandler<HTMLButtonElement>;
  onClick: MouseEventHandler<HTMLButtonElement>;
  onFocus?: FocusEventHandler<HTMLButtonElement>;
  onMouseEnter?: MouseEventHandler<HTMLButtonElement>;
  onMouseLeave?: MouseEventHandler<HTMLButtonElement>;
}

function EditorTimelineToolButton({
  ariaLabel,
  ariaPressed,
  className,
  disabled,
  icon: Icon,
  tooltip,
  onBlur,
  onClick,
  onFocus,
  onMouseEnter,
  onMouseLeave,
}: EditorTimelineToolButtonProps) {
  return (
    <span className="tooltip tooltip-bottom" data-tip={tooltip}>
      <button
        aria-label={ariaLabel}
        aria-pressed={ariaPressed}
        className={clsx("btn btn-square btn-xs h-6 min-h-6 w-6", className)}
        disabled={disabled}
        type="button"
        onBlur={onBlur}
        onClick={onClick}
        onFocus={onFocus}
        onMouseEnter={onMouseEnter}
        onMouseLeave={onMouseLeave}
      >
        <Icon size={15} />
      </button>
    </span>
  );
}

export { EditorTimelineToolButton };
