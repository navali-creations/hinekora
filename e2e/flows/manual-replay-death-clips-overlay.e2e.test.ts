import { expect, type Locator, type Page, test } from "@playwright/test";

import type { ReplayClipDetail } from "../../main/modules/replay-clips";
import {
  emitDashboardReplayClipPreviewProgress,
  emitDashboardReplayClipProgress,
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";

const clipPreviewMediaDataUrl =
  "data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28yYXZjMW1wNDEAAAMUbW9vdgAAAGxtdmhkAAAAAAAAAAAAAAAAAAAD6AAAA+gAAQAAAQAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgAAAj90cmFrAAAAXHRraGQAAAADAAAAAAAAAAAAAAABAAAAAAAAA+gAAAAAAAAAAAAAAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAAAABAAAAAABAAAAAQAAAAAAAkZWR0cwAAABxlbHN0AAAAAAAAAAEAAAPoAAAAAAABAAAAAAG3bWRpYQAAACBtZGhkAAAAAAAAAAAAAAAAAABAAAAAQABVxAAAAAAALWhkbHIAAAAAAAAAAHZpZGUAAAAAAAAAAAAAAABWaWRlb0hhbmRsZXIAAAABYm1pbmYAAAAUdm1oZAAAAAEAAAAAAAAAAAAAACRkaW5mAAAAHGRyZWYAAAAAAAAAAQAAAAx1cmwgAAAAAQAAASJzdGJsAAAAvnN0c2QAAAAAAAAAAQAAAK5hdmMxAAAAAAAAAAEAAAAAAAAAAAAAAAAAAAAAABAAEABIAAAASAAAAAAAAAABFUxhdmM2MS4xOS4xMDEgbGlieDI2NAAAAAAAAAAAAAAAGP//AAAANGF2Y0MBZAAK/+EAF2dkAAqs2V7ARAAAAwAEAAADAAg8SJZYAQAGaOvjyyLA/fj4AAAAABBwYXNwAAAAAQAAAAEAAAAUYnRydAAAAAAAABYoAAAAAAAAABhzdHRzAAAAAAAAAAEAAAABAABAAAAAABxzdHNjAAAAAAAAAAEAAAABAAAAAQAAAAEAAAAUc3RzegAAAAAAAALFAAAAAQAAABRzdGNvAAAAAAAAAAEAAANEAAAAYXVkdGEAAABZbWV0YQAAAAAAAAAhaGRscgAAAAAAAAAAbWRpcmFwcGwAAAAAAAAAAAAAAAAsaWxzdAAAACSpdG9vAAAAHGRhdGEAAAABAAAAAExhdmY2MS43LjEwMAAAAAhmcmVlAAACzW1kYXQAAAKtBgX//6ncRem95tlIt5Ys2CDZI+7veDI2NCAtIGNvcmUgMTY0IHIzMTA2IGVhYTY4ZmEgLSBILjI2NC9NUEVHLTQgQVZDIGNvZGVjIC0gQ29weWxlZnQgMjAwMy0yMDIzIC0gaHR0cDovL3d3dy52aWRlb2xhbi5vcmcveDI2NC5odG1sIC0gb3B0aW9uczogY2FiYWM9MSByZWY9MyBkZWJsb2NrPTE6MDowIGFuYWx5c2U9MHgzOjB4MTEzIG1lPWhleCBzdWJtZT03IHBzeT0xIHBzeV9yZD0xLjAwOjAuMDAgbWl4ZWRfcmVmPTEgbWVfcmFuZ2U9MTYgY2hyb21hX21lPTEgdHJlbGxpcz0xIDh4OGRjdD0xIGNxbT0wIGRlYWR6b25lPTIxLDExIGZhc3RfcHNraXA9MSBjaHJvbWFfcXBfb2Zmc2V0PS0yIHRocmVhZHM9MSBsb29rYWhlYWRfdGhyZWFkcz0xIHNsaWNlZF90aHJlYWRzPTAgbnI9MCBkZWNpbWF0ZT0xIGludGVybGFjZWQ9MCBibHVyYXlfY29tcGF0PTAgY29uc3RyYWluZWRfaW50cmE9MCBiZnJhbWVzPTMgYl9weXJhbWlkPTIgYl9hZGFwdD0xIGJfYmlhcz0wIGRpcmVjdD0xIHdlaWdodGI9MSBvcGVuX2dvcD0wIHdlaWdodHA9MiBrZXlpbnQ9MjUwIGtleWludF9taW49MSBzY2VuZWN1dD00MCBpbnRyYV9yZWZyZXNoPTAgcmNfbG9va2FoZWFkPTQwIHJjPWNyZiBtYnRyZWU9MSBjcmY9MjMuMCBxY29tcD0wLjYwIHFwbWluPTAgcXBtYXg9NjkgcXBzdGVwPTQgaXBfcmF0aW89MS40MCBhcT0xOjEuMDAAgAAAABBliIQAFf/+98nvwKbr29+B";

function createReplayClipDetail(
  id: string,
  status: ReplayClipDetail["clip"]["status"] = "ready",
  durationSeconds = 12,
): ReplayClipDetail {
  const createdAt = "2026-06-25T00:00:00.000Z";

  return {
    durationSeconds,
    mediaUrl: status === "ready" ? "/__e2e_clip_preview.mp4" : null,
    clip: {
      createdAt,
      deathTimestamp: createdAt,
      durationSeconds,
      error: null,
      id,
      kind: "manual",
      fileName: status === "ready" ? `${id}.mp4` : null,
      hasMediaFile: status === "ready",
      sizeBytes: 2048,
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
      status,
      targetDurationSeconds: durationSeconds,
      triggerLineHash: `${id}-line`,
      updatedAt: createdAt,
    },
  };
}

async function markVideoReady(page: Page, duration: number) {
  const video = page.locator("video");
  await expect(video).toBeVisible();

  await video.evaluate((element, nextDuration) => {
    const nextVideo = element;

    if (!(nextVideo instanceof HTMLVideoElement)) {
      return;
    }

    Object.defineProperty(nextVideo, "duration", {
      configurable: true,
      value: nextDuration,
    });
    Object.defineProperty(nextVideo, "readyState", {
      configurable: true,
      value: HTMLMediaElement.HAVE_ENOUGH_DATA,
    });
    let currentTime = 0;
    Object.defineProperty(nextVideo, "currentTime", {
      configurable: true,
      get: () => currentTime,
      set: (seconds: number) => {
        currentTime = seconds;
        queueMicrotask(() => {
          nextVideo.dispatchEvent(new Event("seeking", { bubbles: true }));
          nextVideo.dispatchEvent(new Event("seeked", { bubbles: true }));
          nextVideo.dispatchEvent(new Event("timeupdate", { bubbles: true }));
        });
      },
    });

    nextVideo.dispatchEvent(new Event("loadstart", { bubbles: true }));
    nextVideo.dispatchEvent(new Event("loadedmetadata", { bubbles: true }));
    nextVideo.dispatchEvent(new Event("loadeddata", { bubbles: true }));
    nextVideo.dispatchEvent(new Event("canplaythrough", { bubbles: true }));
    nextVideo.dispatchEvent(new Event("canplay", { bubbles: true }));
    nextVideo.dispatchEvent(new Event("timeupdate", { bubbles: true }));
  }, duration);
}

async function installClipPreviewVideoMocks(page: Page) {
  await page.evaluate(() => {
    const state = {
      fastSeekCalls: [] as number[],
      fullscreenCalls: 0,
      pauseCalls: 0,
      playCalls: 0,
    };

    Object.defineProperty(window, "__CLIP_PREVIEW_VIDEO_E2E__", {
      configurable: true,
      value: state,
    });
    Object.defineProperty(HTMLMediaElement.prototype, "play", {
      configurable: true,
      value(this: HTMLMediaElement) {
        state.playCalls += 1;
        Object.defineProperty(this, "paused", {
          configurable: true,
          value: false,
        });
        this.dispatchEvent(new Event("play", { bubbles: true }));

        return Promise.resolve();
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value(this: HTMLMediaElement) {
        state.pauseCalls += 1;
        Object.defineProperty(this, "paused", {
          configurable: true,
          value: true,
        });
        this.dispatchEvent(new Event("pause", { bubbles: true }));
      },
    });
    Object.defineProperty(HTMLMediaElement.prototype, "fastSeek", {
      configurable: true,
      value(this: HTMLMediaElement, seconds: number) {
        state.fastSeekCalls.push(seconds);
        this.currentTime = seconds;
        this.dispatchEvent(new Event("seeked", { bubbles: true }));
      },
    });
    Object.defineProperty(HTMLVideoElement.prototype, "requestFullscreen", {
      configurable: true,
      value() {
        state.fullscreenCalls += 1;

        return Promise.resolve();
      },
    });
  });
}

async function getClipPreviewVideoState(page: Page) {
  return page.evaluate(() => {
    const video = document.querySelector("video");
    const state = (
      window as unknown as {
        __CLIP_PREVIEW_VIDEO_E2E__: {
          fastSeekCalls: number[];
          fullscreenCalls: number;
          pauseCalls: number;
          playCalls: number;
        };
      }
    ).__CLIP_PREVIEW_VIDEO_E2E__;

    return {
      ...state,
      currentTime: video instanceof HTMLVideoElement ? video.currentTime : null,
      muted: video instanceof HTMLVideoElement ? video.muted : null,
      paused: video instanceof HTMLVideoElement ? video.paused : null,
    };
  });
}

async function waitForClipPreviewOverlayToLoad(page: Page) {
  await expect(page.locator("main")).toBeVisible();
  await expect(
    page
      .locator("body")
      .getByText(/Replay Ready|Preparing Replay/)
      .first(),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue in editor" }),
  ).toBeVisible();
}

async function setupReadyClipPreviewOverlay(
  page: Page,
  input: {
    clipId: string;
    durationSeconds?: number;
    replayClipOperationDelayMs?: number;
  },
) {
  await page.route("**/__e2e_clip_preview.mp4*", (route) =>
    route.fulfill({
      body: Buffer.from(clipPreviewMediaDataUrl.split(",")[1] ?? "", "base64"),
      contentType: "video/mp4",
      status: 200,
    }),
  );
  const replayClipDetails: Record<string, ReplayClipDetail> = {
    [input.clipId]: createReplayClipDetail(
      input.clipId,
      "ready",
      input.durationSeconds,
    ),
  };

  await setupDashboardE2E(page, {
    replayClipDetails,
    initialHash: `/#/clip-preview-overlay?clipId=${input.clipId}`,
    ...(input.replayClipOperationDelayMs !== undefined
      ? { replayClipOperationDelayMs: input.replayClipOperationDelayMs }
      : {}),
    skipDashboardShellChecks: true,
  });
  const replayClipDetail = replayClipDetails[input.clipId];
  if (!replayClipDetail) {
    throw new Error("Expected replay clip detail to exist");
  }

  await installClipPreviewVideoMocks(page);
  await waitForClipPreviewOverlayToLoad(page);
  await markVideoReady(
    page,
    replayClipDetail.durationSeconds ??
      replayClipDetail.clip.durationSeconds ??
      input.durationSeconds ??
      12,
  );

  return replayClipDetail;
}

async function getRequiredBoundingBox(locator: Locator) {
  const box = await locator.boundingBox();
  if (!box) {
    throw new Error("Expected element to have a bounding box");
  }

  return box;
}

async function clickTimelineAtPercent(page: Page, percent: number) {
  const track = page.getByRole("group", { name: "Clip trim timeline" });
  const box = await getRequiredBoundingBox(track);
  await page.mouse.click(box.x + box.width * percent, box.y + box.height / 2);
}

async function dragTimelineControl(input: {
  page: Page;
  source: Locator;
  targetPercent: number;
}) {
  const track = input.page.getByRole("group", {
    name: "Clip trim timeline",
  });
  const sourceBox = await getRequiredBoundingBox(input.source);
  const trackBox = await getRequiredBoundingBox(track);

  await input.page.mouse.move(
    sourceBox.x + sourceBox.width / 2,
    sourceBox.y + sourceBox.height / 2,
  );
  await input.page.mouse.down();
  await input.page.mouse.move(
    trackBox.x + trackBox.width * input.targetPercent,
    sourceBox.y + sourceBox.height / 2,
    { steps: 10 },
  );
  await input.page.mouse.up();
}

async function expectPlaybackTimestamp(page: Page, timestamp: string) {
  await expect(page.getByText(timestamp)).toBeVisible();
}

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

test("shows live preview preparation progress", async ({ page }) => {
  const clipId = "clip-preparing";
  await setupDashboardE2E(page, {
    initialHash: `/#/clip-preview-overlay?clipId=${clipId}`,
    replayClipDetails: {
      [clipId]: createReplayClipDetail(clipId, "saving_replay", 12),
    },
    skipDashboardShellChecks: true,
  });
  await waitForClipPreviewOverlayToLoad(page);

  const progress = page.getByRole("progressbar", {
    name: "Preview preparation progress",
  });
  await expect(progress).toHaveAttribute("aria-valuenow", "0");
  await emitDashboardReplayClipPreviewProgress(page, {
    clipId,
    progress: 0.42,
  });
  await expect(progress).toHaveAttribute("aria-valuenow", "42");
  await expect(page.getByText("42%")).toBeVisible();
});

test("covers manual replay and death clip overlay actions", async ({
  page,
}) => {
  const clipId = "clip-1";
  await setupReadyClipPreviewOverlay(page, { clipId });

  await expect(
    page.getByText(
      "Manual Replays and Death Clips are available on the Clips page.",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "Dismiss clips page info" }).click();
  await expect(
    page.getByText(
      "Manual Replays and Death Clips are available on the Clips page.",
    ),
  ).toBeHidden();
  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.settingsUpdates.at(-1);
    })
    .toMatchObject({ clipPreviewInfoAlertDismissed: true });

  const nameInput = page.getByRole("textbox");
  const namePlaceholder = await nameInput.getAttribute("placeholder");
  expect(namePlaceholder).toBeTruthy();
  await expect(page.getByText(".mp4")).toBeVisible();
  await nameInput.fill("Renamed clip.mp4");
  await expect(nameInput).toHaveValue("Renamed clip");

  const revealButton = page.getByLabel("Show clip in Explorer");
  const fullscreenButton = page.getByLabel("Open clip fullscreen");
  const muteButton = page.getByLabel("Mute replay");
  const playButton = page.getByLabel("Play replay");
  const continueButton = page.getByRole("button", {
    name: "Continue in editor",
  });

  await expect(revealButton).toBeEnabled();
  await expect(fullscreenButton).toBeEnabled();
  await expect(muteButton).toBeEnabled();
  await expect(playButton).toBeEnabled();

  await revealButton.click();
  await muteButton.click();
  await expect(page.getByLabel("Unmute replay")).toBeVisible();
  await expect
    .poll(async () => {
      const state = await getClipPreviewVideoState(page);

      return state.muted;
    })
    .toBe(true);

  await playButton.click();
  await expect(page.getByLabel("Pause replay")).toBeVisible();
  await expect
    .poll(async () => {
      const state = await getClipPreviewVideoState(page);

      return state.playCalls;
    })
    .toBe(1);

  const beforeTimelineSeek = await getClipPreviewVideoState(page);
  await clickTimelineAtPercent(page, 0.5);
  await expectPlaybackTimestamp(page, "06.00 / 12.00");
  await expect
    .poll(async () => {
      const state = await getClipPreviewVideoState(page);

      return {
        pauseCalls: state.pauseCalls - beforeTimelineSeek.pauseCalls,
        playCalls: state.playCalls - beforeTimelineSeek.playCalls,
      };
    })
    .toEqual({ pauseCalls: 1, playCalls: 1 });

  await page.getByLabel("Pause replay").click();
  await expect(page.getByLabel("Play replay")).toBeVisible();
  await expect
    .poll(async () => {
      const state = await getClipPreviewVideoState(page);

      return state.pauseCalls;
    })
    .toBeGreaterThanOrEqual(1);

  await fullscreenButton.click();
  await expect
    .poll(async () => {
      const state = await getClipPreviewVideoState(page);

      return state.fullscreenCalls;
    })
    .toBe(1);

  await continueButton.click({ force: true });
  const calls = await getDashboardE2ECalls(page);
  expect(calls.replayClipRevealCalls).toEqual([clipId]);
  expect(calls.mainWindowOpenEditorClipCalls.at(-1)).toMatchObject({
    id: clipId,
    title: "Renamed clip",
  });

  await page.getByLabel("Close replay preview").click({ force: true });
  const closeCalls = await getDashboardE2ECalls(page);
  expect(closeCalls.clipPreviewOverlayWindowActions).toContain(
    "hideClipPreview",
  );
});

test("shows save processing progress and persists clip changes", async ({
  page,
}) => {
  const clipId = "clip-2";
  await setupReadyClipPreviewOverlay(page, {
    clipId,
    replayClipOperationDelayMs: 750,
  });
  const nameInput = page.getByRole("textbox");
  await nameInput.fill("Saved replay");

  await page.getByRole("button", { name: "Save clip" }).click({ force: true });
  await expect(
    page.getByRole("button", { name: "Processing..." }),
  ).toBeVisible();
  await expect(nameInput).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard" }),
  ).toBeDisabled();
  await expect(
    page.getByRole("button", { name: "Continue in editor" }),
  ).toBeDisabled();

  await expect
    .poll(async () => {
      const calls = await getDashboardE2ECalls(page);

      return calls.replayClipUpdateCalls.at(-1) ?? null;
    })
    .toMatchObject({
      id: clipId,
      name: "Saved replay",
    });

  const calls = await getDashboardE2ECalls(page);
  const operationRequestId =
    calls.replayClipUpdateCalls.at(-1)?.operationRequestId;
  if (operationRequestId) {
    await emitDashboardReplayClipProgress(page, {
      operationRequestId,
      progress: 0.42,
    });
  }
  await expect
    .poll(async () =>
      page
        .getByRole("button", { name: "Processing..." })
        .evaluate((button) =>
          button.style.getPropertyValue("--clip-processing-progress"),
        ),
    )
    .toBe("42%");

  await expect(page.getByRole("button", { name: "Save clip" })).toBeVisible();
  await expect(page.getByText("Clip saved.")).toBeVisible();
});

test("covers trim end, selection grabbing, and timeline marker clamping", async ({
  page,
}) => {
  await setupReadyClipPreviewOverlay(page, {
    clipId: "clip-3",
    durationSeconds: 20,
  });
  await expect(page.getByLabel("Trim clip start")).toBeVisible();
  await expectPlaybackTimestamp(page, "00.00 / 20.00");

  await clickTimelineAtPercent(page, 0.5);
  await expectPlaybackTimestamp(page, "10.00 / 20.00");

  await dragTimelineControl({
    page,
    source: page.getByLabel("Trim clip start"),
    targetPercent: 0.25,
  });
  await expectPlaybackTimestamp(page, "05.00 / 20.00");
  await dragTimelineControl({
    page,
    source: page.getByLabel("Trim clip end"),
    targetPercent: 0.75,
  });
  await expectPlaybackTimestamp(page, "15.00 / 20.00");

  await clickTimelineAtPercent(page, 0.1);
  await expectPlaybackTimestamp(page, "05.00 / 20.00");
  await clickTimelineAtPercent(page, 0.5);
  await expectPlaybackTimestamp(page, "10.00 / 20.00");
  await clickTimelineAtPercent(page, 0.9);
  await expectPlaybackTimestamp(page, "15.00 / 20.00");

  const selection = page.getByLabel("Move selected trim range");
  const selectionBox = await getRequiredBoundingBox(selection);
  const trackBox = await getRequiredBoundingBox(
    page.getByRole("group", { name: "Clip trim timeline" }),
  );
  await page.mouse.move(
    selectionBox.x + selectionBox.width / 2,
    selectionBox.y + selectionBox.height / 2,
  );
  await page.mouse.down();
  await page.waitForTimeout(275);
  await expect
    .poll(() =>
      selection.evaluate((element) => getComputedStyle(element).cursor),
    )
    .toBe("grabbing");
  await page.mouse.move(
    trackBox.x + trackBox.width * 0.7,
    selectionBox.y + selectionBox.height / 2,
    { steps: 10 },
  );
  await page.mouse.up();
  await expectPlaybackTimestamp(page, "09.00 / 20.00");

  await page.getByRole("button", { name: "Copy to clipboard" }).click();
  await page.getByRole("button", { name: "Save clip" }).click();

  const calls = await getDashboardE2ECalls(page);
  const copyCall = calls.replayClipCopyCalls.at(-1);
  const saveCall = calls.replayClipUpdateCalls.at(-1);
  expect(copyCall?.trim).toBeDefined();
  expect(saveCall?.trim).toBeDefined();
  if (!copyCall?.trim || !saveCall?.trim) {
    return;
  }

  expect(copyCall.trim.inSeconds).toBeGreaterThanOrEqual(8.9);
  expect(copyCall.trim.inSeconds).toBeLessThanOrEqual(9.1);
  expect(copyCall.trim.outSeconds).toBeGreaterThanOrEqual(18.9);
  expect(copyCall.trim.outSeconds).toBeLessThanOrEqual(19.1);
  expect(saveCall.trim.inSeconds).toEqual(copyCall.trim.inSeconds);
  expect(saveCall.trim.outSeconds).toEqual(copyCall.trim.outSeconds);

  const progressId = copyCall.operationRequestId;
  if (progressId) {
    await emitDashboardReplayClipProgress(page, {
      operationRequestId: progressId,
      progress: 0.42,
    });
  }

  const updatedCalls = await getDashboardE2ECalls(page);
  expect(updatedCalls.replayClipCopyCalls.at(-1)).toEqual(copyCall);
});
