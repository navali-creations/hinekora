import { describe, expect, it, vi } from "vitest";

import {
  publishEditorPlaybackVisualTime,
  subscribeEditorPlaybackVisualTime,
} from "./EditorPlaybackVisualTime.utils";

describe("EditorPlaybackVisualTime utils", () => {
  it("publishes visual playback time to active subscribers only", () => {
    const firstListener = vi.fn();
    const secondListener = vi.fn();
    const unsubscribeFirst = subscribeEditorPlaybackVisualTime(firstListener);
    const unsubscribeSecond = subscribeEditorPlaybackVisualTime(secondListener);

    publishEditorPlaybackVisualTime(1.25);
    unsubscribeFirst();
    publishEditorPlaybackVisualTime(2.5);
    unsubscribeSecond();
    publishEditorPlaybackVisualTime(3.75);

    expect(firstListener).toHaveBeenCalledTimes(1);
    expect(firstListener).toHaveBeenCalledWith(1.25);
    expect(secondListener).toHaveBeenCalledTimes(2);
    expect(secondListener).toHaveBeenLastCalledWith(2.5);
  });
});
