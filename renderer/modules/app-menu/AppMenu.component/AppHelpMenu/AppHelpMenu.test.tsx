import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  openWhatsNew: vi.fn(),
  useAppMenuShallow: vi.fn(),
}));

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: { children: ReactNode; to: string }) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
}));

vi.mock("~/renderer/store", () => ({
  useAppMenuShallow: storeMocks.useAppMenuShallow,
}));

import { AppHelpMenu } from "./AppHelpMenu";

let container: HTMLDivElement;
let root: Root;

describe("AppHelpMenu", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.useAppMenuShallow.mockImplementation((selector) =>
      selector({ openWhatsNew: storeMocks.openWhatsNew }),
    );
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("closes after selecting a help menu action", async () => {
    await act(async () => {
      root.render(<AppHelpMenu />);
    });
    const details = container.querySelector("details");
    const separators = container.querySelectorAll('[role="separator"]');
    const whatsNewButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("What's New"));
    if (!details || !whatsNewButton) {
      throw new Error("Expected help menu to render");
    }
    details.setAttribute("open", "");

    expect(separators).toHaveLength(3);
    for (const separator of separators) {
      expect(separator.className).toContain("divider");
      expect(separator.className).toContain("h-px");
      expect(separator.className).toContain("before:h-px");
      expect(separator.className).toContain("after:h-px");
    }

    await act(async () => {
      whatsNewButton.click();
    });

    expect(details.hasAttribute("open")).toBe(false);
    expect(storeMocks.openWhatsNew).toHaveBeenCalledTimes(1);
  });
});
