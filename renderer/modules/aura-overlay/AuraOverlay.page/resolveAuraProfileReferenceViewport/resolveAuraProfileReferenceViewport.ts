import type { Profile } from "~/types";
import type { AuraVideoSize } from "../AuraOverlay.page.utils.types";

function resolveAuraProfileReferenceViewport(
  profile: Profile | null,
): AuraVideoSize | null {
  const width = profile?.captureTarget?.width;
  const height = profile?.captureTarget?.height;

  return width && height ? { height, width } : null;
}

export { resolveAuraProfileReferenceViewport };
