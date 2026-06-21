import type { ChangeEvent } from "react";

import { useCropEditorShallow } from "~/renderer/store";

function CropPreviewAuraVisibilityToggle() {
  const { setShowAllAurasInPreview, showAllAurasInPreview } =
    useCropEditorShallow((cropEditor) => ({
      setShowAllAurasInPreview: cropEditor.setShowAllAurasInPreview,
      showAllAurasInPreview: cropEditor.showAllAurasInPreview,
    }));

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    setShowAllAurasInPreview(event.currentTarget.checked);
  };

  return (
    <label className="label cursor-pointer gap-2 py-0 text-primary text-xs">
      <input
        aria-label="Show all auras"
        checked={showAllAurasInPreview}
        className="checkbox checkbox-primary checkbox-xs"
        type="checkbox"
        onChange={handleChange}
      />
      <span className="label-text text-primary text-xs">Show all auras</span>
    </label>
  );
}

export { CropPreviewAuraVisibilityToggle };
