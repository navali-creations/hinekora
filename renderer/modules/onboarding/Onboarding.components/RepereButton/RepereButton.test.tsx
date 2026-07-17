import { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";

import { RepereButton } from "./RepereButton";

it("normalizes Repere popover attributes before rendering the button", async () => {
  const container = document.createElement("div");
  const root = createRoot(container);
  const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

  await act(async () => {
    root.render(
      <RepereButton
        popovertarget="onboarding-popover"
        popovertargetaction="hide"
      />,
    );
  });

  const button = container.querySelector("button");
  expect(button?.getAttribute("popovertarget")).toBe("onboarding-popover");
  expect(button?.getAttribute("popovertargetaction")).toBe("hide");
  expect(consoleError.mock.calls.flat().join(" ")).not.toContain(
    "Invalid DOM property",
  );

  root.unmount();
  consoleError.mockRestore();
});
