import clsx from "clsx";
import type { MouseEvent } from "react";

interface TabsBoxItem<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
  tabId?: string;
  panelId?: string;
}

interface TabsBoxTabsProps<T extends string> {
  items: readonly TabsBoxItem<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "xs" | "sm" | "md";
}

function TabsBoxTabs<T extends string>({
  items,
  value,
  onChange,
  size = "md",
}: TabsBoxTabsProps<T>) {
  const handleTabClick = (event: MouseEvent<HTMLButtonElement>) => {
    const nextValue = event.currentTarget.dataset.value as T | undefined;
    if (!nextValue || nextValue === value) {
      return;
    }

    onChange(nextValue);
  };

  return (
    <>
      {items.map((item) => {
        const isActive = value === item.value;

        return (
          <button
            aria-controls={item.panelId}
            aria-selected={isActive}
            className={clsx(
              "tab border-0 bg-transparent px-4 font-semibold text-base-content/60 transition-colors hover:bg-base-300 hover:text-primary disabled:text-base-content/40 disabled:hover:bg-transparent disabled:hover:text-base-content/40",
              size === "md" && "h-10",
              isActive &&
                "tab-active !bg-base-300 !text-primary shadow-sm hover:!bg-base-300 hover:!text-primary",
            )}
            data-value={item.value}
            disabled={item.disabled}
            id={item.tabId}
            key={item.value}
            role="tab"
            tabIndex={isActive ? 0 : -1}
            type="button"
            onClick={handleTabClick}
          >
            {item.label}
          </button>
        );
      })}
    </>
  );
}

export type { TabsBoxItem };
export { TabsBoxTabs };
