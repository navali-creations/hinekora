import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";

import { AuraOverlayControlsHelp } from "./AuraOverlayControlsHelp";

describe("AuraOverlayControlsHelp", () => {
  let root: Root | null = null;

  afterEach(() => {
    root?.unmount();
    root = null;
    document.body.replaceChildren();
  });

  it("lists aura editing controls and selection use cases", async () => {
    const container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);

    await act(async () => {
      root?.render(<AuraOverlayControlsHelp />);
    });

    expect(container.textContent).toContain("Ctrl");
    expect(container.textContent).toContain("Undo the last aura edit.");
    expect(container.textContent).toContain("Corner circles");
    expect(container.textContent).toContain("Filled arc circle");
    expect(container.textContent).toContain("Match icon size");
    expect(container.textContent).toContain(
      "match their width and height to the anchor",
    );
    expect(container.textContent).toContain("Panel arrow");
    expect(container.textContent).toContain("Default aura");
    expect(container.textContent).toContain("action bar cooldowns");
    expect(container.textContent).toContain("Arched aura");
    expect(container.textContent).toContain("energy shield");
    expect(container.textContent).toContain("Pointer aura");
    expect(container.textContent).toContain("ward");
    expect(
      container.querySelector('summary[aria-label="Show aura controls help"]'),
    ).toBeInstanceOf(HTMLElement);
    expect(container.querySelectorAll("svg")).toHaveLength(4);
  });
});
