import { act, type ReactNode } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const repereMocks = vi.hoisted(() => ({
  beacons: vi.fn(),
}));

const storeMocks = vi.hoisted(() => ({
  beaconHostRefreshKey: 3,
}));

vi.mock("@repere/react", () => {
  const ReperePopover = Object.assign(
    ({ children }: { children: ReactNode }) => <section>{children}</section>,
    {
      AcknowledgeButton: ({ children }: { children: ReactNode }) => (
        <button type="button">{children}</button>
      ),
      Content: ({ children }: { children: ReactNode }) => <div>{children}</div>,
      Footer: ({ children }: { children: ReactNode }) => (
        <footer>{children}</footer>
      ),
      Title: ({ children }: { children: ReactNode }) => (
        <header>{children}</header>
      ),
    },
  );

  return {
    AnchorPoint: {
      BottomCenter: "bottom-center",
      BottomLeft: "bottom-left",
      BottomRight: "bottom-right",
      LeftCenter: "left-center",
      RightCenter: "right-center",
      TopCenter: "top-center",
      TopLeft: "top-left",
    },
    Animation: {
      Fade: "fade",
      SlideDown: "slide-down",
    },
    Beacons: repereMocks.beacons,
    PositioningStrategy: {
      Fixed: "fixed",
    },
    ReperePopover,
    RepereTrigger: ({ children }: { children: ReactNode }) => (
      <button type="button">{children}</button>
    ),
  };
});

vi.mock("@tanstack/react-router", () => ({
  useLocation: () => ({
    pathname: "/editor",
  }),
}));

vi.mock("~/renderer/store", () => ({
  useOnboardingState: () => ({
    beaconHostRefreshKey: storeMocks.beaconHostRefreshKey,
  }),
}));

import { allOnboardingBeaconIds } from "../../onboarding-config/onboarding-labels";
import { BeaconHost } from "./BeaconHost";

let container: HTMLDivElement;
let root: Root;

describe("BeaconHost", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
    repereMocks.beacons.mockImplementation(() => (
      <div data-testid="beacons">beacons</div>
    ));
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
    vi.clearAllMocks();
  });

  it("passes the current route and config to Repere", async () => {
    await act(async () => {
      root.render(<BeaconHost enabled={false} />);
    });

    expect(repereMocks.beacons.mock.calls[0]?.[0]).toMatchObject({
      currentPath: "/editor",
      enabled: false,
    });
    const beaconsProps = repereMocks.beacons.mock.calls[0]?.[0] as {
      config: {
        pages: {
          beacons: { id: string }[];
        }[];
      };
    };
    const configuredBeaconIds = beaconsProps.config.pages.flatMap((page) =>
      page.beacons.map((beacon) => beacon.id),
    );

    expect(configuredBeaconIds).toEqual(allOnboardingBeaconIds);
  });
});
