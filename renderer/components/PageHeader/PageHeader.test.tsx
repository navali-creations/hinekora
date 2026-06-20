import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { PageHeader } from "./PageHeader";

let container: HTMLDivElement;
let root: Root;

async function renderHeader(subtitle?: string) {
  await act(async () => {
    root.render(<PageHeader title="Editor" subtitle={subtitle} />);
  });
}

describe("PageHeader", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("renders the subtitle only when provided", async () => {
    await renderHeader();

    expect(container.querySelector("h1")?.textContent).toBe("Editor");
    expect(container.querySelector("p")).toBeNull();

    await renderHeader("Editing clip.mp4");

    expect(container.querySelector("p")?.textContent).toBe("Editing clip.mp4");
  });
});
