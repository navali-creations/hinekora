import type { AnchorHTMLAttributes, ReactNode } from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { SidebarNav } from "./SidebarNav";

interface MockLinkProps
  extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "href"> {
  children: ReactNode;
  to: string;
}

interface MockRouterState {
  location: {
    pathname: string;
  };
}

vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to, ...props }: MockLinkProps) => (
    <a href={to} {...props}>
      {children}
    </a>
  ),
  useRouterState: ({
    select,
  }: {
    select: (state: MockRouterState) => unknown;
  }) =>
    select({
      location: {
        pathname: "/",
      },
    }),
}));

let container: HTMLDivElement;
let root: Root;

describe("SidebarNav", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders saved edits after editor in the primary navigation", async () => {
    await act(async () => {
      root.render(<SidebarNav />);
    });

    const labels = [...container.querySelectorAll("a")].map((link) =>
      link.textContent?.trim(),
    );

    expect(labels).toEqual([
      "Dashboard",
      "Clips",
      "Recordings",
      "Rewinds",
      "Bookmarks",
      "Aura Manager",
      "Editor",
      "Saved Edits",
    ]);
  });
});
