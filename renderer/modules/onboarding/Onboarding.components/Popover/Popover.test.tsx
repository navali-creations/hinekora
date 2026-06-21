import type { PopoverComponentProps } from "@repere/react";
import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const analyticsMocks = vi.hoisted(() => ({
  trackEvent: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  dismissedBeacons: ["game-selector"] as string[],
  dismissAll: vi.fn(),
  refreshBeaconHost: vi.fn(),
}));

vi.mock("@repere/react", () => {
  const ReperePopover = Object.assign(
    ({ children, className }: { children: ReactNode; className?: string }) => (
      <section className={className} data-testid="repere-popover">
        {children}
      </section>
    ),
    {
      AcknowledgeButton: ({ children, ...props }: { children: ReactNode }) => (
        <button {...props} type="button">
          {children}
        </button>
      ),
      Content: ({
        children,
        className,
      }: {
        children: ReactNode;
        className?: string;
      }) => <div className={className}>{children}</div>,
      Footer: ({
        children,
        className,
      }: {
        children: ReactNode;
        className?: string;
      }) => <footer className={className}>{children}</footer>,
      Title: ({ children }: { children: ReactNode }) => (
        <header>{children}</header>
      ),
    },
  );

  return { ReperePopover };
});

vi.mock("~/renderer/modules/umami", () => ({
  trackEvent: analyticsMocks.trackEvent,
}));

vi.mock("~/renderer/store", () => ({
  useBoundStore: {
    getState: () => ({
      onboarding: {
        dismissedBeacons: storeMocks.dismissedBeacons,
      },
    }),
  },
  useOnboardingActions: () => ({
    dismissAll: storeMocks.dismissAll,
    refreshBeaconHost: storeMocks.refreshBeaconHost,
  }),
}));

import { Popover } from "./Popover";

let container: HTMLDivElement;
let root: Root;

async function renderPopover() {
  const popoverProps = {
    anchorPoint: "bottom-center",
    beacon: {
      id: "game-selector",
    },
    beaconId: "game-selector",
    isOpen: true,
    onClose: vi.fn(),
    onDismiss: vi.fn(),
  } as unknown as PopoverComponentProps;

  await act(async () => {
    root.render(
      <Popover {...popoverProps} title="Game selection">
        Content
      </Popover>,
    );
  });
}

describe("Popover", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    storeMocks.dismissedBeacons = ["game-selector"];
    storeMocks.dismissAll.mockImplementation(async () => {
      storeMocks.dismissedBeacons = ["game-selector", "overlay-icon"];
    });
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("dismisses all onboarding beacons and refreshes Repere", async () => {
    await renderPopover();
    const dismissAllButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Dismiss All"));

    await act(async () => {
      dismissAllButton?.click();
    });

    expect(storeMocks.dismissAll).toHaveBeenCalledTimes(1);
    expect(storeMocks.refreshBeaconHost).toHaveBeenCalledTimes(1);
    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-all-dismissed",
      {
        source: "popover",
        beaconId: "game-selector",
      },
    );
  });

  it("tracks when the beacon is acknowledged", async () => {
    await renderPopover();
    const acknowledgeButton = Array.from(
      container.querySelectorAll("button"),
    ).find((button) => button.textContent?.includes("Got it"));

    await act(async () => {
      acknowledgeButton?.click();
    });

    expect(analyticsMocks.trackEvent).toHaveBeenCalledWith(
      "onboarding-step-acknowledged",
      {
        beaconId: "game-selector",
      },
    );
  });
});
