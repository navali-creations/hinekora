import { describe, expect, it } from "vitest";

import {
  getCellClassName,
  getHeaderClassName,
  resolveSortBy,
} from "./SavedEditsPanel.utils";

describe("SavedEditsPanel utils", () => {
  it("returns table classes and sort fallbacks", () => {
    expect(getHeaderClassName("durationSeconds")).toContain("text-right");
    expect(getHeaderClassName("historyEditCount")).toContain("text-right");
    expect(getCellClassName("title")).toContain("max-w-0");
    expect(getCellClassName("sizeBytes")).toContain("text-right");
    expect(resolveSortBy("historyEditCount")).toBe("historyEditCount");
    expect(resolveSortBy("sizeBytes")).toBe("sizeBytes");
    expect(resolveSortBy("unknown")).toBe("updatedAt");
  });
});
