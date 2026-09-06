import clsx from "clsx";
import type { MouseEventHandler } from "react";
import { FiLayers } from "react-icons/fi";

import { getAuraSelectionTypeHelp } from "~/renderer/modules/aura-selection/AuraSelection.utils/AuraSelection.utils";

import {
  type AuraScaleCategory,
  type AuraScaleCategoryCounts,
  auraScaleCategories,
} from "../AuraOverlayBulkResize/AuraOverlayBulkResize.utils";

const categoryLabels: Record<AuraScaleCategory, string> = {
  arc: "Arc",
  points: "Pointer",
  rect: "Default",
};

interface AuraOverlayBulkResizeCategoryControlsProps {
  allCategoriesSelected: boolean;
  categoryCounts: AuraScaleCategoryCounts;
  selectedCategories: AuraScaleCategory[];
  onCategoryToggle: MouseEventHandler<HTMLButtonElement>;
}

function AuraOverlayBulkResizeCategoryControls({
  allCategoriesSelected,
  categoryCounts,
  selectedCategories,
  onCategoryToggle,
}: AuraOverlayBulkResizeCategoryControlsProps) {
  return (
    <fieldset className="grid gap-1.5">
      <legend className="mb-1 font-black text-base-content">Apply to</legend>
      <div className="grid grid-cols-2 gap-1.5">
        <button
          aria-pressed={allCategoriesSelected}
          className={clsx("btn btn-xs min-w-0 justify-start gap-1.5 px-2", {
            "btn-outline border-primary/30 bg-base-100 text-primary":
              !allCategoriesSelected,
            "btn-primary": allCategoriesSelected,
          })}
          data-category="all"
          type="button"
          onClick={onCategoryToggle}
        >
          <FiLayers aria-hidden="true" size={13} />
          <span>All types ({categoryCounts.all})</span>
        </button>
        {auraScaleCategories.map((category) => {
          const selected = selectedCategories.includes(category);
          const selectionType = getAuraSelectionTypeHelp(category);
          const CategoryIcon = selectionType.Icon;

          return (
            <button
              aria-pressed={selected}
              className={clsx("btn btn-xs min-w-0 justify-start gap-1.5 px-2", {
                "btn-outline border-primary/30 bg-base-100 text-primary":
                  !selected,
                "btn-primary": selected,
              })}
              data-category={category}
              key={category}
              type="button"
              onClick={onCategoryToggle}
            >
              <CategoryIcon
                aria-hidden="true"
                className={selectionType.iconClassName}
                size={13}
              />
              <span>
                {categoryLabels[category]} ({categoryCounts[category]})
              </span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export { AuraOverlayBulkResizeCategoryControls };
