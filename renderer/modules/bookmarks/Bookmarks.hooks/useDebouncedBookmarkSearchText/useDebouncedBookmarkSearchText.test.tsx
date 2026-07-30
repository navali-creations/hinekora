import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDebouncedBookmarkSearchText } from "./useDebouncedBookmarkSearchText";

function DebouncedSearchValue({
  resetKey,
  searchText,
}: {
  resetKey: string;
  searchText: string;
}) {
  const value = useDebouncedBookmarkSearchText(searchText, resetKey);

  return <span>{value}</span>;
}

describe("useDebouncedBookmarkSearchText", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.useFakeTimers();
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.useRealTimers();
  });

  it("trims and debounces search text", () => {
    act(() => {
      root.render(
        <DebouncedSearchValue resetKey="recording-1" searchText=" atlas " />,
      );
    });
    expect(container.textContent).toBe("atlas");

    act(() => {
      root.render(
        <DebouncedSearchValue resetKey="recording-1" searchText=" beach " />,
      );
    });
    expect(container.textContent).toBe("atlas");

    act(() => vi.advanceTimersByTime(250));
    expect(container.textContent).toBe("beach");
  });

  it("clears a stale search immediately when the source changes", () => {
    act(() => {
      root.render(
        <DebouncedSearchValue resetKey="recording-1" searchText="atlas" />,
      );
    });

    act(() => {
      root.render(
        <DebouncedSearchValue resetKey="recording-2" searchText="atlas" />,
      );
    });

    expect(container.textContent).toBe("");
  });
});
