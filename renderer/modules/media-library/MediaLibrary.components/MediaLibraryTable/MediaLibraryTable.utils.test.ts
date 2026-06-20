import { describe, expect, it } from "vitest";

import { isInteractiveTableTarget } from "./MediaLibraryTable.utils";

describe("MediaLibraryTable utils", () => {
  it("recognizes interactive targets that should not trigger row navigation", () => {
    const row = document.createElement("tr");
    row.setAttribute("role", "button");
    const button = document.createElement("button");
    const input = document.createElement("input");
    const ignored = document.createElement("span");
    ignored.dataset.rowClickIgnore = "true";
    const text = document.createElement("span");
    row.append(button, input, ignored, text);

    expect(isInteractiveTableTarget(button)).toBe(true);
    expect(isInteractiveTableTarget(input)).toBe(true);
    expect(isInteractiveTableTarget(ignored)).toBe(true);
    expect(isInteractiveTableTarget(text)).toBe(false);
    expect(isInteractiveTableTarget(row)).toBe(false);
    expect(isInteractiveTableTarget(null)).toBe(false);
  });
});
