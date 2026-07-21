import clsx from "clsx";
import type { ReactNode } from "react";
import { FiAlertCircle } from "react-icons/fi";

interface NoticeAlertProps {
  actions?: ReactNode;
  children: ReactNode;
  dismissLabel?: string;
  onDismiss?: () => void;
  title: ReactNode;
  tone?: "info" | "warning";
}

function NoticeAlert({
  actions,
  children,
  dismissLabel = "Dismiss notice",
  onDismiss,
  title,
  tone = "info",
}: NoticeAlertProps) {
  const hasActions = actions !== undefined || onDismiss !== undefined;

  return (
    <div
      className={clsx(
        "grid items-start gap-3 rounded-lg border px-4 py-3 text-[0.8125rem] leading-relaxed shadow-sm",
        {
          "grid-cols-[auto_minmax(0,1fr)_auto]": hasActions,
          "grid-cols-[auto_minmax(0,1fr)]": !hasActions,
          "border-info bg-secondary text-info": tone === "info",
          "border-warning/40 bg-warning/10 text-base-content":
            tone === "warning",
        },
      )}
      role="status"
    >
      <FiAlertCircle
        className={clsx("mt-0.5", {
          "text-info": tone === "info",
          "text-warning": tone === "warning",
        })}
        size={18}
      />
      <div className="min-w-0">
        <p className="m-0 font-semibold">{title}</p>
        <div
          className={clsx({
            "text-base-content/70": tone === "warning",
            "text-info": tone === "info",
          })}
        >
          {children}
        </div>
      </div>
      {hasActions && (
        <div className="flex shrink-0 items-center gap-2">
          {actions}
          {onDismiss && (
            <button
              aria-label={dismissLabel}
              className={clsx("btn btn-xs px-2", {
                "border-info/20 bg-base-300/80 text-info hover:bg-base-300":
                  tone === "info",
                "btn-ghost text-current": tone === "warning",
              })}
              title={dismissLabel}
              type="button"
              onClick={onDismiss}
            >
              Dismiss
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { NoticeAlert };
