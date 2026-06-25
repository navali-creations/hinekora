import { expect, test } from "@playwright/test";

import {
  clickTimelineMarkerAtClipOffset,
  dragLocatorBy,
  expectNoTimelineOverlap,
  expectNoUnexpectedEditorBridgeCalls,
  expectTimelineOrder,
  getEditorE2ECalls,
  openEditorActionsMenu,
  readRenderedTimelineClips,
  setupEditorE2E,
  waitForSavedProjectCount,
} from "../helpers/editor-fixture";

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedEditorBridgeCalls(page);
});

test("normalizes corrupted editor timeline state before autosaving UI edits", async ({
  page,
}) => {
  await setupEditorE2E(page);
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);

  const renderedClips = await readRenderedTimelineClips(page);
  expectTimelineOrder(renderedClips);
  await expectNoTimelineOverlap(page);

  await page
    .locator("[data-clip-body='true'][data-clip-id='timeline-c']")
    .click();
  await waitForSavedProjectCount(page, 1);

  const calls = await getEditorE2ECalls(page);
  const savedClips = calls.savedProjects.at(-1)?.tracks[0]?.clips ?? [];
  expectTimelineOrder(savedClips);
  expectNoOverlappingClips(savedClips);
});

test("covers asset rail, project picker, rename, history, retention, and new edit controls", async ({
  page,
}) => {
  await setupEditorE2E(page);
  const initialCalls = await getEditorE2ECalls(page);

  await page.locator("[data-asset-key='clip:asset-1']").click();
  await expect(page.locator("video[title='asset-1.mp4']")).toBeVisible();

  await page.getByLabel("Media type").selectOption("recording");
  await expect(
    page.getByRole("button", { name: /recording-1\.mp4/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Refresh media" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.workspaceQueries.length;
    })
    .toBeGreaterThan(initialCalls.workspaceQueries.length);

  await page.getByLabel("Media type").selectOption("manual-replay");
  await expect(
    page.getByRole("button", { name: /manual-1\.mp4/ }),
  ).toBeVisible();

  await page.getByLabel("Editor project").selectOption("project-2");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(1);
  await expect(
    page.locator("[data-clip-body='true'][data-clip-id='timeline-second']"),
  ).toBeVisible();

  await page.getByRole("button", { name: "Rename project" }).click();
  await page.getByLabel("Project name").fill("Renamed edit");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await waitForSavedProjectCount(page, 1);
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.savedProjects.at(-1)?.title;
    })
    .toBe("Renamed edit");

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Show history" }).click();
  await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
  await page.getByRole("button", { name: "Close history panel" }).click();
  await expect(page.getByRole("heading", { name: "History" })).toBeHidden();

  await openEditorActionsMenu(page);
  await page.getByLabel("Auto-prune all but last 5 edits").check();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.settingsUpdates.at(-1);
    })
    .toEqual({ editorAutoPruneProjects: true });

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "New edit" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.createProjectInputs.length;
    })
    .toBe(1);
});

test("covers copy and export dialog actions", async ({ page }) => {
  await setupEditorE2E(page);

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.copyRequests.length;
    })
    .toBe(1);

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(
    page.getByRole("heading", { name: "Save edited clip" }),
  ).toBeVisible();
  await page.getByLabel("File name").fill("boss-kill.mp4");
  await page.getByRole("button", { name: "Override" }).click();
  await page.getByRole("button", { name: "720p" }).click();
  await page.getByRole("button", { name: "Export video" }).click();

  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.exportRequests.at(-1);
    })
    .toMatchObject({
      fileName: "boss-kill.mp4",
      mode: "overwrite",
      resolution: "720p",
    });
});

test("covers destructive confirmation modals", async ({ page }) => {
  await setupEditorE2E(page);

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Delete edit" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete edit?" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.deletedProjectIds;
    })
    .toEqual([]);

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Delete edit" }).click();
  await page
    .getByRole("button", { name: "Delete edit", exact: true })
    .last()
    .click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.deletedProjectIds;
    })
    .toEqual(["project-1"]);

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Delete all edits" }).click();
  await expect(
    page.getByRole("heading", { name: "Delete all edits?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete all edits", exact: true })
    .last()
    .click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.deleteAllCount;
    })
    .toBe(1);
});

test("covers timeline toolbar, playback controls, zoom, and keyboard shortcuts", async ({
  page,
}) => {
  await setupEditorE2E(page);

  await page.getByRole("button", { name: "Seek forward 5 seconds" }).click();
  await expect(
    page.getByText("0:05.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Jump to start" }).click();
  await expect(
    page.getByText("0:00.00", { exact: true }).first(),
  ).toBeVisible();
  await page.getByRole("button", { name: "Play preview" }).click();
  await expect(
    page.getByRole("button", { name: "Pause preview" }),
  ).toBeVisible();
  await expect.poll(async () => readPlaybackSeconds(page)).toBeGreaterThan(0);
  await page.getByRole("button", { name: "Pause preview" }).click();
  await expect(
    page.getByRole("button", { name: "Play preview" }),
  ).toBeVisible();

  const timelineWidthBeforeZoom = await page
    .locator("[data-timeline-grid='true']")
    .evaluate((element) => (element as HTMLElement).style.width);
  await page.getByRole("button", { name: "Zoom in timeline" }).click();
  await expect
    .poll(async () =>
      page
        .locator("[data-timeline-grid='true']")
        .evaluate((element) => (element as HTMLElement).style.width),
    )
    .not.toBe(timelineWidthBeforeZoom);
  await page.getByRole("button", { name: "Zoom out timeline" }).click();

  await clickTimelineMarkerAtClipOffset({
    clipId: "timeline-a",
    offsetSeconds: 1,
    page,
  });
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+Y");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.getByRole("button", { name: "Delete selected clip" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);

  await page.locator("[data-timeline-gap-zone='true']").first().hover();
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-timeline-gap-zone='true']")).toHaveCount(0);
  await expectNoTimelineOverlap(page);
});

test("covers timeline pointer move, trimming, and asset drag into the track", async ({
  page,
}) => {
  await setupEditorE2E(page);
  const clipBeforeMove = await readClip(page, "timeline-c");

  await dragLocatorBy(
    page.locator("[data-clip-body='true'][data-clip-id='timeline-c']"),
    { x: 140, y: 0 },
  );
  await expect
    .poll(async () => {
      const clip = await readClip(page, "timeline-c");

      return clip.startSeconds;
    })
    .toBeGreaterThan(clipBeforeMove.startSeconds);
  await expectNoTimelineOverlap(page);

  const clipBeforeTrim = await readClip(page, "timeline-b");
  await dragLocatorBy(
    page.locator("[data-trim-edge='end'][data-clip-id='timeline-b']"),
    { x: -60, y: 0 },
  );
  await expect
    .poll(async () => {
      const clip = await readClip(page, "timeline-b");

      return clip.durationSeconds;
    })
    .toBeLessThan(clipBeforeTrim.durationSeconds);

  await page.getByLabel("Media type").selectOption("manual-replay");
  await dragAssetToTimeline(page, /manual-1\.mp4/);
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);
  await expectNoTimelineOverlap(page);
});

async function readClip(
  page: Parameters<typeof readRenderedTimelineClips>[0],
  id: string,
) {
  const clips = await readRenderedTimelineClips(page);
  const clip = clips.find((item) => item.id === id);
  if (!clip) {
    throw new Error(`Timeline clip ${id} was not rendered`);
  }

  return clip;
}

async function dragAssetToTimeline(
  page: Parameters<typeof readRenderedTimelineClips>[0],
  assetName: RegExp,
) {
  const asset = page.getByRole("button", { name: assetName });
  const track = page.locator("[data-timeline-video-track='true']").first();
  const assetBox = await asset.boundingBox();
  const trackBox = await track.boundingBox();
  if (!assetBox || !trackBox) {
    throw new Error("Cannot drag asset without source and target bounds");
  }

  await page.mouse.move(
    assetBox.x + assetBox.width / 2,
    assetBox.y + assetBox.height / 2,
  );
  await page.mouse.down();
  await page.mouse.move(
    trackBox.x + trackBox.width / 2,
    trackBox.y + trackBox.height / 2,
    {
      steps: 10,
    },
  );
  await page.mouse.up();
}

async function readPlaybackSeconds(
  page: Parameters<typeof readRenderedTimelineClips>[0],
) {
  const value = await page
    .locator("[data-editor-playback-time='true']")
    .textContent();
  const match = value?.trim().match(/^(\d+):(\d{2})\.(\d{2})$/);
  if (!match) {
    throw new Error(`Unexpected playback timestamp: ${value ?? "<empty>"}`);
  }

  return Number(match[1]) * 60 + Number(match[2]) + Number(match[3]) / 100;
}

function expectNoOverlappingClips(
  clips: Array<{ durationSeconds: number; startSeconds: number }>,
) {
  let cursorSeconds = 0;

  for (const clip of clips) {
    expect(clip.startSeconds).toBeGreaterThanOrEqual(cursorSeconds);
    cursorSeconds = clip.startSeconds + clip.durationSeconds;
  }
}
