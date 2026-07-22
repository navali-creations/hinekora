import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SavedVideoItem } from "~/main/modules/saved-videos";

const storeMocks = vi.hoisted(() => ({
  deleteVideo: vi.fn(),
  openVideo: vi.fn(),
  revealVideo: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useSavedVideosShallow: (selector: (state: typeof storeMocks) => unknown) =>
    selector(storeMocks),
}));

import { SavedVideoTableActions } from "./SavedVideoTableActions";

const video: SavedVideoItem = {
  fileName: "Saved.mp4",
  id: "a".repeat(64),
  savedAt: "2026-07-21T00:00:00.000Z",
  sizeBytes: 1024,
};
let container: HTMLDivElement;
let root: Root;

beforeEach(() => {
  vi.clearAllMocks();
  HTMLDialogElement.prototype.showModal = function showModal() {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close() {
    this.open = false;
    this.dispatchEvent(new Event("close"));
  };
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
});

afterEach(() => {
  root.unmount();
  document.body.replaceChildren();
});

describe("SavedVideoTableActions", () => {
  it("opens, reveals, and confirms deletion of an export", async () => {
    await act(async () => {
      root.render(<SavedVideoTableActions video={video} />);
    });

    await act(async () => {
      container
        .querySelector<HTMLButtonElement>("[aria-label^='Play']")
        ?.click();
      container
        .querySelector<HTMLButtonElement>("[aria-label*='in explorer']")
        ?.click();
      container
        .querySelector<HTMLButtonElement>("[aria-label^='Delete']")
        ?.click();
    });
    expect(storeMocks.openVideo).toHaveBeenCalledWith(video.id);
    expect(storeMocks.revealVideo).toHaveBeenCalledWith(video.id);
    expect(document.body.textContent).toContain("Delete saved edit?");

    await act(async () => {
      Array.from(document.body.querySelectorAll("button"))
        .find((button) => button.textContent === "Delete video")
        ?.click();
    });
    expect(storeMocks.deleteVideo).toHaveBeenCalledWith(video.id);
  });
});
