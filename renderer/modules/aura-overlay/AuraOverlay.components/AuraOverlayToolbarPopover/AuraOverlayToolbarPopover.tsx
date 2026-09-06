import type { ReactNode } from "react";

interface AuraOverlayToolbarPopoverProps {
  buttonAriaLabel: string;
  buttonTitle: string;
  children: ReactNode;
  description: string;
  icon: ReactNode;
  indicatorCount?: number;
  panelAriaLabel: string;
  title: string;
}

const panelClassName =
  "absolute right-0 bottom-[calc(100%+1rem)] z-30 grid w-[min(20rem,calc(100vw-2rem))] max-h-[min(33rem,calc(100vh-5rem))] gap-3 overflow-y-auto rounded-lg border border-primary/35 bg-base-300/85 p-3 text-primary text-xs leading-snug shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-base-300)_48%,transparent),0_14px_36px_rgb(0_0_0_/_34%),0_0_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] backdrop-blur-md [scrollbar-color:color-mix(in_oklch,var(--color-primary)_42%,transparent)_transparent] max-[760px]:max-h-[min(24rem,calc(100vh-5rem))]";
const buttonClassName =
  "relative grid size-[var(--aura-editing-bar-height,2.875rem)] cursor-pointer place-items-center rounded-lg border border-primary/40 bg-base-300/85 text-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-base-300)_48%,transparent),0_0_20px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] backdrop-blur-md hover:border-primary hover:bg-primary/15 focus-visible:border-primary focus-visible:bg-primary/15";

function AuraOverlayToolbarPopover({
  buttonAriaLabel,
  buttonTitle,
  children,
  description,
  icon,
  indicatorCount = 0,
  panelAriaLabel,
  title,
}: AuraOverlayToolbarPopoverProps) {
  return (
    <details
      className="no-drag relative flex-none [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden"
      name="aura-overlay-toolbar-popover"
    >
      <summary
        aria-label={buttonAriaLabel}
        className={buttonClassName}
        title={buttonTitle}
      >
        {icon}
        {indicatorCount > 0 && (
          <span
            aria-label={`${indicatorCount} active options`}
            className="pointer-events-none absolute top-0 right-0 grid h-4 min-w-4 translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#14b8a6] bg-base-300 px-1 font-black text-[#14b8a6] text-[0.625rem] leading-none"
          >
            {indicatorCount}
          </span>
        )}
      </summary>

      <aside aria-label={panelAriaLabel} className={panelClassName}>
        <header className="grid gap-0.5">
          <h2 className="m-0 font-black text-sm leading-tight">{title}</h2>
          <p className="m-0 font-bold text-[0.6875rem] text-primary/75">
            {description}
          </p>
        </header>
        {children}
      </aside>
    </details>
  );
}

export { AuraOverlayToolbarPopover };
