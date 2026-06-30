import {
  auraSelectionShapes,
  getAuraSelectionTypeHelp,
} from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

import type { CropSelectorShape } from "../../CropSelectorOverlay.utils/CropSelectorOverlay.utils";

interface CropSelectorControlsHelpProps {
  shape: CropSelectorShape;
}

const keyboardControls = [
  {
    keys: ["Right click"],
    text: "Reset the current target and start the same selection type again.",
  },
  {
    keys: ["Enter"],
    text: "Confirm a pointer selection after choosing its points.",
  },
];

const panelClassName =
  "no-drag fixed top-[18.75rem] right-5 z-[5] grid w-[min(20rem,calc(100vw-2rem))] max-h-[min(33rem,max(12rem,calc(100vh-20rem)))] gap-3 overflow-y-auto rounded-lg border border-primary/35 bg-base-300/85 p-3 text-primary text-xs leading-snug shadow-[0_0_0_1px_color-mix(in_oklch,var(--color-base-300)_48%,transparent),0_14px_36px_rgb(0_0_0_/_34%),0_0_24px_color-mix(in_oklch,var(--color-primary)_18%,transparent)] backdrop-blur-md [scrollbar-color:color-mix(in_oklch,var(--color-primary)_42%,transparent)_transparent] max-[760px]:top-[5.5rem] max-[760px]:right-4 max-[760px]:max-h-[min(24rem,max(12rem,calc(100vh-7rem)))]";
const itemClassName =
  "grid grid-cols-[minmax(5.25rem,max-content)_1fr] items-baseline gap-2";
const shapeItemClassName = "grid grid-cols-[1.5rem_1fr] items-start gap-2";
const shapeIconClassName =
  "grid size-6 place-items-center rounded-md border border-primary/40 bg-primary/10 text-primary shadow-[0_0_14px_color-mix(in_oklch,var(--color-primary)_24%,transparent)]";

function CropSelectorControlsHelp({ shape }: CropSelectorControlsHelpProps) {
  const activeShape = getAuraSelectionTypeHelp(shape);

  return (
    <aside aria-label="Grid selector controls" className={panelClassName}>
      <header className="grid gap-0.5">
        <h2 className="m-0 font-black text-sm leading-tight">Grid selector</h2>
        <p className="m-0 font-bold text-[0.6875rem] text-primary/75">
          Active mode:{" "}
          <span className="font-black text-emerald-300">
            {activeShape.name}
          </span>
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
              <span className="font-bold text-primary/80">{control.text}</span>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid gap-1.5">
        <h3 className="m-0 font-black text-[0.6875rem] text-base-content uppercase">
          Selections
        </h3>
        <ul className="m-0 grid list-none gap-2 p-0">
          {auraSelectionShapes.map((selectionShape) => {
            const selectionType = getAuraSelectionTypeHelp(selectionShape);
            const SelectionIcon = selectionType.Icon;

            return (
              <li className={shapeItemClassName} key={selectionShape}>
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
                    {selectionType.selectorText}
                  </span>
                </span>
              </li>
            );
          })}
        </ul>
      </section>
    </aside>
  );
}

export { CropSelectorControlsHelp };
