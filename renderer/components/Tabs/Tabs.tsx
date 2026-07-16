import clsx from "clsx";
import type { KeyboardEvent, MouseEvent, ReactNode } from "react";

interface TabItem<T extends string> {
  value: T;
  label: ReactNode;
  disabled?: boolean;
  tabId?: string;
  panelId?: string;
}

interface TabsProps<T extends string> {
  ariaLabel: string;
  className?: string;
  dataOnboarding?: string;
  disabled?: boolean;
  items: readonly TabItem<T>[];
  layout?: "content" | "equal";
  selectionRole?: "radio" | "tab";
  size?: "xs" | "sm";
  value: T;
  onChange: (value: T) => void;
}

function Tabs<T extends string>({
  ariaLabel,
  className,
  dataOnboarding,
  disabled = false,
  items,
  layout = "content",
  selectionRole = "tab",
  size = "xs",
  value,
  onChange,
}: TabsProps<T>) {
  const handleTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const nextValue = event.currentTarget.dataset.value as T | undefined;
    if (!nextValue || nextValue === value) {
      return;
    }

    onChange(nextValue);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (
      event.key !== "ArrowLeft" &&
      event.key !== "ArrowRight" &&
      event.key !== "Home" &&
      event.key !== "End"
    ) {
      return;
    }

    const tabs = Array.from(
      event.currentTarget.parentElement?.querySelectorAll<HTMLButtonElement>(
        `[role="${selectionRole}"]:not(:disabled)`,
      ) ?? [],
    );
    const currentIndex = tabs.indexOf(event.currentTarget);
    if (currentIndex < 0 || tabs.length === 0) {
      return;
    }

    event.preventDefault();
    const nextIndex =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : event.key === "ArrowRight"
            ? (currentIndex + 1) % tabs.length
            : (currentIndex - 1 + tabs.length) % tabs.length;
    const nextTab = tabs[nextIndex];
    const nextValue = nextTab?.dataset.value as T | undefined;
    if (!nextTab || !nextValue) {
      return;
    }

    nextTab.focus();
    if (nextValue !== value) {
      onChange(nextValue);
    }
  };

  return (
    <div
      aria-label={ariaLabel}
      className={clsx(
        "tabs tabs-box flex-nowrap overflow-x-auto rounded-md bg-base-300 p-1",
        {
          "inline-flex": layout === "content",
          "flex w-full": layout === "equal",
          "tabs-sm": size === "sm",
          "tabs-xs": size === "xs",
        },
        className,
      )}
      data-onboarding={dataOnboarding}
      role={selectionRole === "radio" ? "radiogroup" : "tablist"}
    >
      {items.map((item) => {
        const isActive = value === item.value;
        const isDisabled = disabled || item.disabled === true;

        return (
          <button
            aria-checked={selectionRole === "radio" ? isActive : undefined}
            aria-controls={selectionRole === "tab" ? item.panelId : undefined}
            aria-selected={selectionRole === "tab" ? isActive : undefined}
            className={clsx(
              "tab min-w-0 cursor-pointer whitespace-nowrap rounded-md border-0 bg-transparent font-semibold text-base-content/65 transition-colors duration-150 hover:bg-base-200 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-base-content/70 focus-visible:outline-offset-[-2px] active:translate-y-px motion-reduce:transform-none disabled:cursor-not-allowed disabled:opacity-45 disabled:hover:bg-transparent disabled:hover:text-base-content/65",
              {
                "flex-1": layout === "equal",
                "px-3": size === "xs",
                "px-4": size === "sm",
                "shrink-0": layout === "content",
                "tab-active !bg-primary !text-primary-content shadow-sm hover:!bg-primary hover:!text-primary-content":
                  isActive,
              },
            )}
            data-value={item.value}
            disabled={isDisabled}
            id={item.tabId}
            key={item.value}
            role={selectionRole}
            tabIndex={isActive ? 0 : -1}
            type="button"
            onClick={handleTabClick}
            onKeyDown={handleTabKeyDown}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type { TabItem };
export { Tabs };
