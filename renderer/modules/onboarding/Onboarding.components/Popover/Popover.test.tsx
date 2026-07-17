import type { PopoverComponentProps } from "@repere/react";
import { act, type ElementType, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const storeMocks = vi.hoisted(() => ({
  acknowledge: vi.fn(),
  dismissedBeacons: ["game-selector"] as string[],
  dismissAll: vi.fn(),
  refreshBeaconHost: vi.fn(),
}));

vi.mock("@repere/react", () => {
  const ReperePopover = Object.assign(
    ({
      children,
      className,
      onClose,
    }: {
      children: ReactNode;
      className?: string;
      onClose?: () => void;
    }) => (
      <section className={className} data-testid="repere-popover">
        <button aria-label="Close beacon" type="button" onClick={onClose}>
          Close
        </button>
        {children}
      </section>
    ),
    {
      AcknowledgeButton: ({
        as: Component = "button",
        children,
        ...props
      }: {
        as?: ElementType;
        children: ReactNode;
      }) => (
        <Component
          {...props}
          popovertarget="repere-popover"
          popovertargetaction="hide"
          type="button"
          onClick={storeMocks.acknowledge}
        >
          {children}
        </Component>
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

  return popoverProps;
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
  });

  it("forwards close and renders the Repere acknowledgement action", async () => {
    const popoverProps = await renderPopover();

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>('button[aria-label="Close beacon"]')
        ?.click();
      Array.from(container.querySelectorAll("button"))
        .find((button) => button.textContent === "Got it")
        ?.click();
    });

    expect(popoverProps.onClose).toHaveBeenCalledOnce();
    expect(storeMocks.acknowledge).toHaveBeenCalledOnce();
  });
});
