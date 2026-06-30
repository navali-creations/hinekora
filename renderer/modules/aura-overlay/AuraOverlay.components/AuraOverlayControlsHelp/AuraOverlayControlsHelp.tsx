import { FiHelpCircle } from "react-icons/fi";

import {
  auraSelectionShapes,
  getAuraSelectionTypeHelp,
} from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

const keyboardControls = [
  {
    keys: ["Ctrl", "Z"],
    text: "Undo the last aura edit.",
  },
  {
    keys: ["Ctrl", "Y"],
    text: "Redo the last undone edit.",
  },
  {
    keys: ["Del"],
    text: "Delete the selected aura.",
  },
];

const editingControls = [
  {
    term: "Number fields",
    text: "Type values directly, or scroll focused inputs to fine tune size, scale, rotation, spacing, and thickness.",
  },
  {
    term: "Corner circles",
    text: "Drag a corner handle to resize the selected aura.",
  },
  {
    term: "Filled arc circle",
    text: "Drag it to change the thickness of the selected arched cut.",
  },
];

const helpPanelClassName =
  "absolute right-0 bottom-[calc(100%+1rem)] z-30 grid w-[min(20rem,calc(100vw-2rem))] max-h-[min(33rem,calc(100vh-5rem))] gap-3 overflow-y-auto rounded-lg border border-primary/35 bg-base-300/85 p-3 text-primary text-xs leading-snug shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-base-300)_48%,transparent),0_14px_36px_rgb(0_0_0_/_34%),0_0_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] backdrop-blur-md [scrollbar-color:color-mix(in_oklch,var(--color-primary)_42%,transparent)_transparent] max-[760px]:max-h-[min(24rem,calc(100vh-5rem))]";
const helpButtonClassName =
  "grid size-[var(--aura-editing-bar-height,2.875rem)] cursor-pointer place-items-center rounded-lg border border-primary/40 bg-base-300/85 text-primary shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-base-300)_48%,transparent),0_0_20px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] backdrop-blur-md hover:border-primary hover:bg-primary/15 focus-visible:border-primary focus-visible:bg-primary/15";
const itemClassName =
  "grid grid-cols-[minmax(4.75rem,max-content)_1fr] items-baseline gap-2";
const shapeItemClassName = "grid grid-cols-[1.5rem_1fr] items-start gap-2";
const shapeIconClassName =
  "grid size-6 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary shadow-[0_0_14px_color-mix(in_oklch,var(--color-primary)_24%,transparent)]";

function AuraOverlayControlsHelp() {
  return (
    <details className="no-drag relative flex-none [&>summary]:list-none [&>summary::-webkit-details-marker]:hidden">
      <summary
        aria-label="Show aura controls help"
        className={helpButtonClassName}
        title="Aura controls help"
      >
        <FiHelpCircle size={18} />
      </summary>

      <aside aria-label="Aura overlay controls" className={helpPanelClassName}>
        <header className="grid gap-0.5">
          <h2 className="m-0 font-black text-sm leading-tight">
            Aura controls
          </h2>
          <p className="m-0 font-bold text-[0.6875rem] text-primary/75">
            Quick reference while editing overlays.
          </p>
        </header>

        <section className="grid gap-1.5">
          <h3 className="m-0 font-black text-[0.6875rem] text-base-content uppercase">
            Keyboard
          </h3>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {keyboardControls.map((control) => (
              <li className={itemClassName} key={control.text}>
                <span className="inline-flex flex-wrap items-center gap-0.5">
                  {control.keys.map((key) => (
                    <kbd
                      className="kbd kbd-xs min-w-5 text-center font-black text-[0.6875rem]"
                      key={key}
                    >
                      {key}
                    </kbd>
                  ))}
                </span>
                <span className="font-bold text-primary/80">
                  {control.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-1.5">
          <h3 className="m-0 font-black text-[0.6875rem] text-base-content uppercase">
            Editing
          </h3>
          <ul className="m-0 grid list-none gap-1.5 p-0">
            {editingControls.map((control) => (
              <li className={itemClassName} key={control.term}>
                <span className="font-black text-primary">{control.term}</span>
                <span className="font-bold text-primary/80">
                  {control.text}
                </span>
              </li>
            ))}
          </ul>
        </section>

        <section className="grid gap-1.5">
          <h3 className="m-0 font-black text-[0.6875rem] text-base-content uppercase">
            Aura types
          </h3>
          <ul className="m-0 grid list-none gap-2 p-0">
            {auraSelectionShapes.map((shape) => {
              const selectionType = getAuraSelectionTypeHelp(shape);
              const SelectionIcon = selectionType.Icon;

              return (
                <li className={shapeItemClassName} key={shape}>
                  <span className={shapeIconClassName} aria-hidden="true">
                    <SelectionIcon
                      className={selectionType.iconClassName}
                      size={15}
                    />
                  </span>
                  <span className="grid min-w-0 gap-0.5">
                    <span className="font-black text-base-content">
                      {selectionType.name}
                    </span>
                    <span className="font-bold text-primary/75">
                      {selectionType.overlayText}
                    </span>
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      </aside>
    </details>
  );
}

export { AuraOverlayControlsHelp };
