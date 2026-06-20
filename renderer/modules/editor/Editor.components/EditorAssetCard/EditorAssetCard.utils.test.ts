import { describe, expect, it } from "vitest";

import { createEditorTestAsset } from "../../Editor.slice/Editor.slice.test-utils";
import { assetStatusLabel } from "./EditorAssetCard.utils";

describe("EditorAssetCard utils", () => {
  it("formats unavailable asset statuses", () => {
    expect(
      assetStatusLabel(
        createEditorTestAsset({ exists: false, status: "ready" }),
      ),
    ).toBe("Missing");
    expect(assetStatusLabel(createEditorTestAsset({ status: "missing" }))).toBe(
      "Missing",
    );
    expect(
      assetStatusLabel(createEditorTestAsset({ status: "processing" })),
    ).toBe("Processing");
    expect(assetStatusLabel(createEditorTestAsset({ status: "failed" }))).toBe(
      "Failed",
    );
    expect(assetStatusLabel(createEditorTestAsset())).toBe("Unavailable");
  });
});
