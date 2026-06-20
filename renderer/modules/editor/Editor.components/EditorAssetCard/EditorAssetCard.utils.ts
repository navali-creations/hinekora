import type { EditorMediaAsset } from "~/main/modules/editor";

function assetStatusLabel(asset: EditorMediaAsset): string {
  if (!asset.exists || asset.status === "missing") {
    return "Missing";
  }

  if (asset.status === "processing") {
    return "Processing";
  }

  if (asset.status === "failed") {
    return "Failed";
  }

  return "Unavailable";
}

export { assetStatusLabel };
