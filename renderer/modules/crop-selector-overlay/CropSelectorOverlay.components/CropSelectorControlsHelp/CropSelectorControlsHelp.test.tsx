import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { CropSelectorControlsHelp } from "./CropSelectorControlsHelp";

describe("CropSelectorControlsHelp", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
  });

  it("lists grid selector shortcuts and aura selection guidance", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<CropSelectorControlsHelp shape="points" />);
    });

    expect(container.textContent).toContain("Active mode:");
    expect(container.textContent).toContain("Pointer aura");
    expect(container.textContent).toContain("Right click");
    expect(container.textContent).toContain("Reset the current target");
    expect(container.textContent).toContain("Esc");
    expect(container.textContent).toContain("Confirm selected pointer points");
    expect(container.textContent).toContain("Default aura");
    expect(container.textContent).toContain("Arched aura");
    expect(container.textContent).toContain("ward");
    expect(container.querySelector(".kbd")).toBeInstanceOf(HTMLElement);
    expect(container.querySelectorAll("svg")).toHaveLength(3);
    expect(
      container.querySelector("[aria-hidden='true']")?.className,
    ).toContain("text-primary");
  });
});
