import { describe, expect, it } from "vitest";

import { resolveEditorExportRemainingTime } from "./EditorExportView.utils";

describe("EditorExportView utils", () => {
  it("uses stable status text before and after a usable estimate", () => {
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 10_000, progress: 0.02 }),
    ).toBe("Estimating time left...");
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 10_000, progress: 0.98 }),
    ).toBe("Finishing up...");
  });

  it("formats second, minute, and hour estimates", () => {
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 10_000, progress: 0.6 }),
    ).toBe("Less than 10 seconds left");
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 30_000, progress: 0.5 }),
    ).toBe("About 30 seconds left");
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 60_000, progress: 0.5 }),
    ).toBe("About 1 minute left");
    expect(
      resolveEditorExportRemainingTime({ elapsedMs: 3_600_000, progress: 0.5 }),
    ).toBe("About 1h left");
  });
});
