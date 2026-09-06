import { FiHelpCircle } from "react-icons/fi";

import {
  auraSelectionShapes,
  getAuraSelectionTypeHelp,
} from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

import { AuraOverlayToolbarPopover } from "../AuraOverlayToolbarPopover/AuraOverlayToolbarPopover";

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
  {
    term: "Snapping",
    text: "When enabled, drag to snap to the grid, screen center, or another aura's teal center and border axes. Resizing also snaps to matching aura scales.",
  },
  {
    term: "Match icon size",
    text: "Choose a size anchor and aura types in Display options, then match their width and height to the anchor.",
  },
  {
    term: "Panel arrow",
    text: "Collapse or expand the selected aura's editing controls.",
  },
];

const itemClassName =
  "grid grid-cols-[minmax(4.75rem,max-content)_1fr] items-baseline gap-2";
const shapeItemClassName = "grid grid-cols-[1.5rem_1fr] items-start gap-2";
const shapeIconClassName =
  "grid size-6 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary shadow-[0_0_14px_color-mix(in_oklch,var(--color-primary)_24%,transparent)]";

function AuraOverlayControlsHelp() {
  return (
    <AuraOverlayToolbarPopover
      buttonAriaLabel="Show aura controls help"
      buttonTitle="Aura controls help"
      description="Quick reference while editing overlays."
      icon={<FiHelpCircle size={18} />}
      panelAriaLabel="Aura overlay controls"
      title="Aura controls"
    >
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
              <span className="font-bold text-primary/80">{control.text}</span>
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
              <span className="font-bold text-primary/80">{control.text}</span>
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
    </AuraOverlayToolbarPopover>
  );
}

export { AuraOverlayControlsHelp };
