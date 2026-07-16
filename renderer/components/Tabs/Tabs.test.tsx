import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Tabs } from "./Tabs";

let container: HTMLDivElement;
let root: Root;

describe("Tabs", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("owns the rounded app rail and selects another tab", async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <Tabs
          ariaLabel="Media scope"
          items={[
            { label: "Timeline", value: "timeline" },
            { label: "Recent", value: "recent" },
            { label: "All", value: "all" },
          ]}
          layout="equal"
          value="all"
          onChange={onChange}
        />,
      );
    });

    const tabList = container.querySelector('[aria-label="Media scope"]');
    const timelineTab = container.querySelector<HTMLButtonElement>(
      '[data-value="timeline"]',
    );
    const allTab =
      container.querySelector<HTMLButtonElement>('[data-value="all"]');

    expect(tabList?.className).toContain("rounded-md");
    expect(tabList?.className).toContain("bg-base-300");
    expect(tabList?.className).toContain("flex-nowrap");
    expect(tabList?.className).toContain("tabs-box");
    expect(tabList?.className).toContain("tabs-xs");
    expect(timelineTab?.className).toContain("flex-1");
    expect(timelineTab?.className).not.toContain("shrink-0");
    expect(allTab?.className).toContain("!bg-primary");
    expect(allTab?.getAttribute("aria-selected")).toBe("true");

    await act(async () => {
      timelineTab?.click();
    });

    expect(onChange).toHaveBeenCalledWith("timeline");
  });

  it("supports segmented radio semantics and a globally disabled state", async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <Tabs
          ariaLabel="Capture mode"
          disabled
          items={[
            { label: "Session Recording", value: "session" },
            { label: "Rewind", value: "rewind" },
          ]}
          selectionRole="radio"
          value="session"
          onChange={onChange}
        />,
      );
    });

    const group = container.querySelector('[aria-label="Capture mode"]');
    const session = container.querySelector<HTMLButtonElement>(
      '[data-value="session"]',
    );
    const rewind = container.querySelector<HTMLButtonElement>(
      '[data-value="rewind"]',
    );

    expect(group?.getAttribute("role")).toBe("radiogroup");
    expect(group?.className).toContain("flex-nowrap");
    expect(session?.getAttribute("role")).toBe("radio");
    expect(session?.getAttribute("aria-checked")).toBe("true");
    expect(session?.hasAttribute("aria-selected")).toBe(false);
    expect(session?.className).toContain("shrink-0");
    expect(session?.className).not.toContain("flex-1");
    expect(session?.disabled).toBe(true);
    expect(rewind?.disabled).toBe(true);
  });

  it("uses roving keyboard selection and skips disabled tabs", async () => {
    const onChange = vi.fn();

    await act(async () => {
      root.render(
        <Tabs
          ariaLabel="Recording settings"
          items={[
            {
              label: "Recording",
              panelId: "recording-panel",
              tabId: "recording-tab",
              value: "recording",
            },
            { disabled: true, label: "Rewind", value: "rewind" },
            {
              label: "Capture",
              panelId: "capture-panel",
              tabId: "capture-tab",
              value: "capture",
            },
          ]}
          value="recording"
          onChange={onChange}
        />,
      );
    });

    const recording = container.querySelector<HTMLButtonElement>(
      '[data-value="recording"]',
    );
    const capture = container.querySelector<HTMLButtonElement>(
      '[data-value="capture"]',
    );
    recording?.focus();

    await act(async () => {
      recording?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "ArrowRight" }),
      );
    });

    expect(onChange).toHaveBeenLastCalledWith("capture");
    expect(document.activeElement).toBe(capture);
    expect(recording?.getAttribute("aria-controls")).toBe("recording-panel");

    await act(async () => {
      capture?.dispatchEvent(
        new KeyboardEvent("keydown", { bubbles: true, key: "Home" }),
      );
    });

    expect(document.activeElement).toBe(recording);
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
