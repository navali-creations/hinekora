import { expect, type Page, test } from "@playwright/test";

import type {
  BookmarkCategory,
  RecordingBookmark,
  RecordingBookmarksPage,
} from "../../main/modules/bookmarks";
import type {
  EditorMediaAsset,
  EditorTimelineClip,
} from "../../main/modules/editor";
import {
  clickTimelineMarkerAtClipOffset,
  completeEditorE2EExport,
  createEditorE2EAsset,
  createEditorE2EProject,
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

async function expectMediaAssetQueryCountToRemainAtMost(
  page: Page,
  maximumCount: number,
) {
  await waitForEditorBridgeToSettle(page);
  const settledQueryCount = (await getEditorE2ECalls(page)).mediaAssetQueries
    .length;
  expect(settledQueryCount).toBeLessThanOrEqual(maximumCount);

  await waitForEditorBridgeToSettle(page);
  expect((await getEditorE2ECalls(page)).mediaAssetQueries.length).toBe(
    settledQueryCount,
  );
}

async function waitForEditorBridgeToSettle(page: Page) {
  await page.evaluate(async () => {
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
    await Promise.resolve();
    await new Promise<void>((resolve) => {
      window.requestAnimationFrame(() => resolve());
    });
  });
}

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

  await page
    .getByRole("button", { name: "Open current media folder in explorer" })
    .click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.revealedClipIds;
    })
    .toEqual(["asset-2"]);

  await page.locator("[data-asset-key='clip:asset-2']").click();
  await page.getByRole("button", { name: "Next media page" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.mediaAssetQueries.some(
        (query) =>
          typeof query === "object" &&
          query !== null &&
          "pageIndex" in query &&
          query.pageIndex === 1,
      );
    })
    .toBe(true);
  await expect(
    page.getByRole("button", { name: /asset-7\.mp4/ }),
  ).toBeVisible();

  await page.getByLabel("Media type").selectOption("recording");
  await expect(
    page.getByRole("button", { name: /recording-1\.mp4/ }),
  ).toBeVisible();
  const callsBeforeMediaRefresh = await getEditorE2ECalls(page);
  await page.getByRole("button", { name: "Refresh media" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.mediaAssetQueries.length;
    })
    .toBeGreaterThan(callsBeforeMediaRefresh.mediaAssetQueries.length);

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
  await expect(
    page.getByLabel("Auto-prune all but last 5 edits"),
  ).toBeChecked();
  await page.getByLabel("Auto-prune all but last 5 edits").uncheck();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.settingsUpdates.at(-1);
    })
    .toEqual({ editorAutoPruneProjects: false });

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

test("covers My Media tabs, pagination, league filters, and moving clips into and out of the timeline", async ({
  page,
}) => {
  await setupEditorE2E(page);
  const mediaRail = page.locator("[data-onboarding='editor-my-media']");

  await page.getByLabel("Media type").selectOption("death-clip");
  await page.getByRole("tab", { name: "All" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();
  await expect(
    mediaRail.getByRole("button", { name: /asset-1\.mp4/ }),
  ).toBeHidden();

  await page.getByRole("button", { name: "Next media page" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-7\.mp4/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous media page" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();

  await page.getByLabel("Editor media league").selectOption("Runes of Aldur");
  await expect(
    mediaRail.getByRole("button", { name: /asset-runes\.mp4/ }),
  ).toBeVisible();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeHidden();

  await page.getByLabel("Editor media league").selectOption("Standard");
  await page.getByRole("tab", { name: "Recent" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.mediaAssetQueries.some(
        (query) =>
          typeof query === "object" &&
          query !== null &&
          "createdAfter" in query,
      );
    })
    .toBe(true);

  const clipsBeforeAdd = await readRenderedTimelineClips(page);
  await dragAssetToTimeline(page, /asset-2\.mp4/);
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(
    clipsBeforeAdd.length + 1,
  );
  const clipsAfterAdd = await readRenderedTimelineClips(page);
  const addedClipId = clipsAfterAdd.find(
    (clip) => !clipsBeforeAdd.some((beforeClip) => beforeClip.id === clip.id),
  )?.id;
  if (!addedClipId) {
    throw new Error("Expected dragging asset-2.mp4 to create a timeline clip");
  }

  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeHidden();
  await page.getByRole("tab", { name: "Timeline" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();

  await page
    .locator(`[data-clip-body='true'][data-clip-id='${addedClipId}']`)
    .click();
  await page.getByRole("button", { name: "Delete selected clip" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(
    clipsBeforeAdd.length,
  );
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeHidden();

  await page.getByRole("tab", { name: "All" }).click();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();
  await expectNoTimelineOverlap(page);
});

test("restores the last selected My Media filter after leaving the editor", async ({
  page,
}) => {
  await setupEditorE2E(page);

  await page.getByLabel("Media type").selectOption("manual-replay");
  await page.getByLabel("Editor media league").selectOption("Standard");
  await expect
    .poll(async () => (await getEditorE2ECalls(page)).settingsUpdates)
    .toContainEqual({ editorMediaFilter: "manual-replay" });

  await page.getByRole("link", { name: "Saved Edits", exact: true }).click();
  await expect(page.getByLabel("Library league")).toHaveValue("Standard");
  await page.getByRole("link", { name: "Editor", exact: true }).click();

  await expect(page.getByLabel("Media type")).toHaveValue("manual-replay");
  await expect(page.getByLabel("Editor media league")).toHaveValue("Standard");
});

test("keeps unavailable clip candidates out while preserving missing recordings", async ({
  page,
}) => {
  const unavailableAssets = Array.from({ length: 5 }, (_, index) => ({
    ...createEditorE2EAsset({
      category: "death-clip",
      createdAt: `2999-01-01T00:00:0${index}.000Z`,
      id: `missing-candidate-${index}`,
      kind: "clip",
      name: `missing-candidate-${index}.mp4`,
      subtitle: "Death clip - Standard",
    }),
    exists: false,
    mediaUrl: null,
    sizeBytes: 0,
  }));
  const unavailableRecording = {
    ...createEditorE2EAsset({
      category: "recording",
      createdAt: "2999-01-01T00:00:10.000Z",
      id: "missing-recording",
      kind: "recording",
      name: "missing-recording.mp4",
      subtitle: "Recording - Standard",
    }),
    exists: false,
    mediaUrl: null,
    sizeBytes: 0,
    status: "missing" as const,
  };
  await setupEditorE2E(page, {
    extraAssets: [...unavailableAssets, unavailableRecording],
  });
  const mediaRail = page.locator("[data-onboarding='editor-my-media']");

  await page.getByLabel("Media type").selectOption("death-clip");
  await page.getByRole("tab", { name: "All" }).click();

  await expect(mediaRail.getByText("6 items")).toBeVisible();
  await expect(
    mediaRail.getByRole("button", { name: /missing-candidate-0\.mp4/ }),
  ).toBeHidden();
  await expect(
    mediaRail.getByRole("button", { name: /asset-2\.mp4/ }),
  ).toBeVisible();

  await page.getByRole("button", { name: "Next media page" }).click();
  await expect(mediaRail.getByText("6 items")).toBeVisible();
  await expect(
    mediaRail.getByRole("button", { name: /asset-7\.mp4/ }),
  ).toBeVisible();
  await expect(
    mediaRail.getByRole("button", { name: /missing-candidate-4\.mp4/ }),
  ).toBeHidden();

  await page.getByLabel("Media type").selectOption("recording");
  const missingRecordingCard = mediaRail.getByRole("button", {
    name: /missing-recording\.mp4/,
  });
  await expect(missingRecordingCard).toBeVisible();
  await expect(missingRecordingCard).toBeDisabled();
});

test("covers editor help, shortcuts, saved-edit rail, and debug actions", async ({
  page,
}) => {
  await setupEditorE2E(page, {
    settings: { editorLogEnabled: true },
  });

  await page.getByRole("button", { name: "Editor help" }).click();
  await expect(
    page.getByRole("heading", { name: "Editor help" }),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Saving" }).click();
  await expect(page.getByText(/Save video renders a new MP4/)).toBeVisible();
  await page.getByRole("tab", { name: "History" }).click();
  await expect(page.getByText(/up to 50 history entries/)).toBeVisible();
  await page.getByRole("tab", { name: "More" }).click();
  await expect(page.getByText("Auto-prune all but last 5:")).toBeVisible();
  await page
    .getByRole("dialog")
    .getByRole("button", { exact: true, name: "Close" })
    .click();
  await expect(page.getByRole("heading", { name: "Editor help" })).toBeHidden();

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Show shortcuts" }).click();
  await expect(page.getByRole("heading", { name: "Shortcuts" })).toBeVisible();
  await expect(
    page.getByText("Split the selected clip at the playhead."),
  ).toBeVisible();
  await page.getByRole("tab", { name: "Editor" }).click();
  await expect(page.getByText("Open the save modal.")).toBeVisible();
  await page.getByRole("button", { name: "Close shortcuts panel" }).click();
  await expect(page.getByRole("heading", { name: "Shortcuts" })).toBeHidden();

  await page.getByLabel("Media type").selectOption("saved-edits");
  await expect(
    page.getByRole("button", { name: /asset-1\.mp4 edit/ }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Open current media folder in explorer" })
    .click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.revealedSavedEditIds;
    })
    .toEqual(["project-1"]);

  const callsBeforeSavedEditOpen = await getEditorE2ECalls(page);
  await page.getByRole("button", { name: /secondary\.mp4 edit/ }).click();
  await expect(page).toHaveURL(/#\/editor\?projectId=project-2/);
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.workspaceQueries.length;
    })
    .toBe(callsBeforeSavedEditOpen.workspaceQueries.length + 1);
  await expectMediaAssetQueryCountToRemainAtMost(
    page,
    callsBeforeSavedEditOpen.mediaAssetQueries.length + 1,
  );

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Debug" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.debugClipboardWrites.at(-1) ?? "";
    })
    .toContain('"capturedAt"');
});

test("covers history rail population and the 50 change retention limit", async ({
  page,
}) => {
  await setupEditorE2E(page);
  await page
    .getByLabel("Editor project")
    .selectOption("project-history-overflow");

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Show history" }).click();
  const historyRail = page.locator("aside", {
    has: page.getByRole("heading", { name: "History" }),
  });

  await expect(historyRail).toBeVisible();
  await expect(historyRail.getByText("50 out of 50 changes")).toBeVisible();
  await expect(
    historyRail.getByText("History edit 51", { exact: true }),
  ).toBeVisible();
  await expect(
    historyRail.getByText("asset-51.mp4", { exact: true }),
  ).toBeVisible();
  await expect(
    historyRail.getByText("History edit 1", { exact: true }),
  ).toBeHidden();
  await expect(historyRail.getByText("#50", { exact: true })).toHaveCount(1);
  await expect(historyRail.getByText("#1", { exact: true })).toHaveCount(0);

  for (let pageIndex = 0; pageIndex < 4; pageIndex += 1) {
    await page.getByRole("button", { name: "Load more" }).click();
  }

  await expect(
    historyRail.getByText("History edit 2", { exact: true }),
  ).toBeVisible();
  await expect(
    historyRail.getByText("asset-2.mp4", { exact: true }),
  ).toBeVisible();
  await expect(
    historyRail.getByText("History edit 1", { exact: true }),
  ).toBeHidden();
  await expect(historyRail.getByText("#1", { exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Load more" })).toBeHidden();
});

test("covers saved edits route library interactions", async ({ page }) => {
  await setupEditorE2E(page);
  await page.goto("/#/saved-edits");
  await expect(
    page.getByRole("heading", { name: "Saved Edits" }),
  ).toBeVisible();

  await page.getByLabel("Library league").selectOption("Standard");
  await expect(page.getByText("asset-1.mp4 edit")).toBeVisible();
  await expect(page.getByText("mixed league edit")).toBeVisible();
  await expect(
    page.getByRole("columnheader", { name: /History/ }),
  ).toBeVisible();
  await expect(page.getByText("0 edits").first()).toBeVisible();

  await page.getByLabel("Library league").selectOption("Runes of Aldur");
  await expect(page.getByText("mixed league edit")).toBeVisible();
  await expect(page.getByText("asset-1.mp4 edit")).toBeHidden();

  await page.getByLabel("Library league").selectOption("Standard");

  await page.goto("/#/editor?projectId=project-mixed-league");
  await page.getByRole("button", { name: "Rename project" }).click();
  await page.getByLabel("Project name").fill("runtime mixed league edit");
  await page.getByRole("button", { name: "Rename", exact: true }).click();
  await waitForSavedProjectCount(page, 1);

  await page.goto("/#/saved-edits");
  await page.getByLabel("Library league").selectOption("Runes of Aldur");
  await expect(page.getByText("runtime mixed league edit")).toBeVisible();
  await page.getByLabel("Library league").selectOption("Standard");
  await expect(page.getByText("runtime mixed league edit")).toBeVisible();

  await page.getByLabel("Open asset-1.mp4 edit in explorer").click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.revealedSavedEditIds;
    })
    .toEqual(["project-1"]);

  const callsBeforeSavedEditOpen = await getEditorE2ECalls(page);
  await page.getByText("asset-1.mp4 edit").click();
  await expect(page).toHaveURL(/#\/editor\?projectId=project-1/);
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.workspaceQueries.length;
    })
    .toBe(callsBeforeSavedEditOpen.workspaceQueries.length + 1);
  await expectMediaAssetQueryCountToRemainAtMost(
    page,
    callsBeforeSavedEditOpen.mediaAssetQueries.length + 1,
  );

  await page.goto("/#/saved-edits");
  await page.getByLabel("Library league").selectOption("Standard");
  await page.getByLabel("Delete saved edit asset-1.mp4 edit").click();
  await expect(
    page.getByRole("heading", { name: "Delete edit?" }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Delete edit", exact: true })
    .last()
    .click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.deletedSavedEditIds;
    })
    .toEqual(["project-1"]);

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

      return calls.savedEditDeleteAllCount;
    })
    .toBe(1);
});

test("covers copy and export dialog actions", async ({ page }) => {
  await setupEditorE2E(page, { manualExportCompletion: true });

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
  await expect(page.getByRole("heading", { name: "Save video" })).toBeVisible();
  await page.getByLabel("File name").fill("boss-kill.mp4");
  await page.getByRole("button", { name: "Override" }).click();
  await page.getByRole("button", { name: "720p" }).click();
  await page.getByRole("button", { name: "Save video" }).click();

  const exportPreview = page.getByLabel("Edited video preview");
  const processingView = page.getByTestId("editor-export-processing-view");
  const exportProgress = processingView.getByRole("progressbar", {
    name: "Video export progress",
  });
  await expect(exportProgress).toBeVisible();
  await expect(exportPreview).toBeVisible();
  await expect(exportProgress).toHaveAttribute("aria-valuenow", "2");
  await expect(exportProgress.locator("..")).not.toContainText("Saving video");
  expect(
    await exportPreview.evaluate((video: HTMLVideoElement) => ({
      autoplay: video.autoplay,
      controls: video.controls,
      muted: video.muted,
    })),
  ).toEqual({ autoplay: false, controls: false, muted: true });
  const progressBox = await exportProgress.boundingBox();
  const previewBox = await exportPreview.boundingBox();
  const processingViewBox = await processingView.boundingBox();
  expect(progressBox).not.toBeNull();
  expect(previewBox).not.toBeNull();
  expect(processingViewBox).not.toBeNull();
  expect((progressBox?.x ?? 0) + (progressBox?.width ?? 0)).toBeLessThan(
    previewBox?.x ?? 0,
  );
  expect(
    (processingViewBox?.x ?? 0) +
      (processingViewBox?.width ?? 0) -
      ((previewBox?.x ?? 0) + (previewBox?.width ?? 0)),
  ).toBeGreaterThanOrEqual(20);

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
  await completeEditorE2EExport(page);

  await expect(
    page.getByRole("button", { exact: true, name: "Keep editing" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Copy to clipboard" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.copiedExportIds;
    })
    .toEqual(["export-1"]);
  await page.getByRole("button", { name: "Open file location" }).click();
  await expect
    .poll(async () => {
      const calls = await getEditorE2ECalls(page);

      return calls.revealedExportIds;
    })
    .toEqual(["export-1"]);
  await page.getByRole("button", { exact: true, name: "Keep editing" }).click();
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
});

test("keeps background export progress visible and confirms cancellation", async ({
  page,
}) => {
  await setupEditorE2E(page, { manualExportCompletion: true });

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save video" }).click();
  await expect(page.getByTestId("editor-export-processing-view")).toBeVisible();
  const processingInformation = page.getByRole("region", {
    name: "Video processing information",
  });
  await expect(processingInformation).toContainText("keep using Hinekora");
  await expect(processingInformation).toContainText(
    "unfinished video is removed",
  );
  await expect(processingInformation).toContainText(
    "Changes apply only to your next video",
  );
  await processingInformation
    .getByRole("button", { name: "Dismiss keep editing safely notice" })
    .click();
  await expect(processingInformation).not.toContainText("Keep editing safely");
  await page.getByRole("button", { name: "Keep editing" }).click();

  const backgroundStatus = page.getByRole("region", {
    name: "Background video processing",
  });
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect(backgroundStatus).toBeVisible();
  await expect(backgroundStatus).toContainText("Saving video");
  await expect(backgroundStatus).toContainText("2%");
  const backgroundStatusBox = await backgroundStatus.boundingBox();
  expect(backgroundStatusBox).not.toBeNull();
  expect(
    (backgroundStatusBox?.y ?? 0) + (backgroundStatusBox?.height ?? 0),
  ).toBeLessThanOrEqual(page.viewportSize()?.height ?? 0);
  await expect(
    backgroundStatus.getByRole("progressbar", {
      name: "Background video export progress",
    }),
  ).toHaveAttribute("value", "2");
  await page.getByLabel("Clip speed: 1x").click();
  await page
    .getByRole("menu", { name: "Clip speed options" })
    .getByRole("menuitemradio", { name: "2x" })
    .click();
  await expect(page.getByLabel("Clip speed: 2x")).toBeVisible();
  await page.keyboard.press("ControlOrMeta+C");
  await expect
    .poll(async () => (await getEditorE2ECalls(page)).copyRequests)
    .toEqual([]);
  await expect
    .poll(async () => {
      const request = (await getEditorE2ECalls(page)).exportRequests.at(-1);

      return request?.project.tracks[0]?.clips[0]?.playbackRate;
    })
    .toBe(1);

  await page.getByRole("link", { name: "Saved Edits" }).click();
  await expect(
    page.getByRole("heading", { name: "Saved Edits" }),
  ).toBeVisible();
  await expect(backgroundStatus).toBeVisible();

  await backgroundStatus.getByRole("button", { name: "Cancel" }).click();
  let confirmation = page.getByRole("dialog", {
    name: "Cancel video processing?",
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Keep processing" }).click();
  await expect(backgroundStatus).toBeVisible();

  await backgroundStatus.getByRole("link", { name: "View" }).click();
  await expect(page.getByTestId("editor-export-processing-view")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Saving video" }),
  ).toBeVisible();
  await expect(page.getByTestId("editor-export-processing-view")).toBeVisible();
  await expect(backgroundStatus).toContainText("2%");
  await expect(processingInformation).not.toContainText("Keep editing safely");
  await page.getByRole("button", { name: "Keep editing" }).click();
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);
  await backgroundStatus.getByRole("link", { name: "View" }).click();
  await expect(page.getByTestId("editor-export-processing-view")).toBeVisible();
  await page.getByRole("button", { name: "Cancel processing" }).click();
  confirmation = page.getByRole("dialog", {
    name: "Cancel video processing?",
  });
  await expect(confirmation).toBeVisible();
  await confirmation.getByRole("button", { name: "Cancel processing" }).click();

  await expect(backgroundStatus).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Editor" })).toBeVisible();
  await expect
    .poll(async () => (await getEditorE2ECalls(page)).cancelExportRequestIds)
    .toEqual([expect.any(String)]);
});

test("keeps a completed background export available from the sidebar", async ({
  page,
}) => {
  await setupEditorE2E(page, { manualExportCompletion: true });

  await openEditorActionsMenu(page);
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "Save video" }).click();
  await page.getByRole("button", { exact: true, name: "Keep editing" }).click();
  await page.getByRole("link", { name: "Saved Edits" }).click();

  const backgroundStatus = page.getByRole("region", {
    name: "Background video processing",
  });
  await expect(backgroundStatus).toBeVisible();
  await completeEditorE2EExport(page);
  await expect(backgroundStatus).toContainText("Video saved", {
    timeout: 5_000,
  });
  await expect(backgroundStatus).toContainText("100%");

  await backgroundStatus.getByRole("link", { name: "View" }).click();
  await expect(
    page.getByRole("heading", { name: "Your video is ready" }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Copy to clipboard" }),
  ).toBeVisible();
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
  await page.getByRole("button", { name: "Seek backward 5 seconds" }).click();
  await expect(
    page.getByText("0:00.00", { exact: true }).first(),
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
  const volumeControl = page.getByLabel("Editor preview volume");
  await expect(volumeControl).toHaveValue("1");
  await volumeControl.focus();
  await page.keyboard.press("Home");
  await expect(volumeControl).toHaveValue("0");
  for (let volumeStep = 0; volumeStep < 35; volumeStep += 1) {
    await page.keyboard.press("ArrowRight");
  }
  await expect(volumeControl).toHaveValue("0.35");

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
  await page.getByRole("button", { name: "Fit timeline" }).click();
  await expect(
    page.getByRole("button", { name: "Fit timeline" }),
  ).toBeDisabled();

  await clickTimelineMarkerAtClipOffset({
    clipId: "timeline-a",
    offsetSeconds: 1,
    page,
  });
  const clipSpeedButton = page.getByLabel("Clip speed: 1x");
  await clipSpeedButton.click();
  const clipSpeedMenu = page.getByRole("menu", {
    name: "Clip speed options",
  });
  const [clipSpeedButtonBox, clipSpeedMenuBox] = await Promise.all([
    clipSpeedButton.boundingBox(),
    clipSpeedMenu.boundingBox(),
  ]);
  expect(clipSpeedButtonBox).not.toBeNull();
  expect(clipSpeedMenuBox).not.toBeNull();
  if (clipSpeedButtonBox && clipSpeedMenuBox) {
    expect(
      Math.abs(
        clipSpeedButtonBox.x +
          clipSpeedButtonBox.width / 2 -
          (clipSpeedMenuBox.x + clipSpeedMenuBox.width / 2),
      ),
    ).toBeLessThanOrEqual(1);
    expect(clipSpeedMenuBox.y + clipSpeedMenuBox.height).toBeLessThanOrEqual(
      clipSpeedButtonBox.y,
    );
    expect(clipSpeedMenuBox.width).toBeLessThanOrEqual(64);
  }
  await page.getByRole("menuitemradio", { name: "16x" }).click();
  await expect(page.getByLabel("Clip speed: 16x")).toBeVisible();
  await page.getByLabel("Clip speed: 16x").click();
  await page.getByRole("menuitemradio", { name: "1x" }).click();
  await expect(page.getByLabel("Clip speed: 1x")).toBeVisible();
  await page.getByRole("button", { name: "Split" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.getByRole("button", { name: "Undo" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);
  await page.getByRole("button", { name: "Redo" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);
  await page.keyboard.press("ControlOrMeta+Y");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.getByRole("button", { name: "Mute audio" }).click();
  await expect(
    page.getByRole("button", { name: "Unmute audio" }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Unmute audio" }).click();
  await expect(page.getByRole("button", { name: "Mute audio" })).toBeVisible();

  await page.getByRole("button", { name: "Delete selected clip" }).click();
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(3);
  await expect(page.locator("[data-timeline-gap-zone='true']")).not.toHaveCount(
    0,
  );
  await page.getByRole("button", { name: "Clear gaps" }).click();
  await expect(page.locator("[data-timeline-gap-zone='true']")).toHaveCount(0);

  await page.keyboard.press("ControlOrMeta+Z");
  await expect(page.locator("[data-timeline-gap-zone='true']")).not.toHaveCount(
    0,
  );
  await page.locator("[data-timeline-gap-zone='true']").first().hover();
  await page.keyboard.press("Delete");
  await expect(page.locator("[data-timeline-gap-zone='true']")).toHaveCount(0);
  await expectNoTimelineOverlap(page);
});

test("covers timeline letter keyboard shortcuts", async ({ page }) => {
  await setupEditorE2E(page);

  await clickTimelineMarkerAtClipOffset({
    clipId: "timeline-a",
    offsetSeconds: 1,
    page,
  });
  await page.keyboard.press("s");
  await expect(page.locator("[data-clip-body='true']")).toHaveCount(4);

  await page.keyboard.press("m");
  await expect(
    page.getByRole("button", { name: "Unmute audio" }),
  ).toBeVisible();
  await page.keyboard.press("m");
  await expect(page.getByRole("button", { name: "Mute audio" })).toBeVisible();

  await page.getByRole("button", { name: "Delete selected clip" }).click();
  await expect(page.locator("[data-timeline-gap-zone='true']")).not.toHaveCount(
    0,
  );
  await page.locator("[data-timeline-grid='true']").click();
  await page.keyboard.press("c");
  await expect(page.locator("[data-timeline-gap-zone='true']")).toHaveCount(0);
});

test("covers editor recording bookmarks, trim filtering, chips, hover, Escape, and multi-recording selection", async ({
  page,
}) => {
  const recordingA = createEditorRecordingAsset("recording-bookmarks-a");
  const recordingB = createEditorRecordingAsset("recording-bookmarks-b");
  const clipA = createEditorRecordingClip(recordingA, {
    durationSeconds: 60,
    id: "timeline-recording-a",
    startSeconds: 0,
  });
  const clipB = createEditorRecordingClip(recordingB, {
    durationSeconds: 30,
    id: "timeline-recording-b",
    startSeconds: 70,
  });
  const recordingBookmarkProject = {
    ...createEditorE2EProject({
      asset: recordingA,
      assets: [recordingA, recordingB],
      clips: [clipA, clipB],
      id: "project-recording-bookmarks",
      title: "recording bookmarks edit",
    }),
    activeClipId: clipA.id,
  };
  const recordingABookmarks = [
    createEditorRecordingBookmark({
      category: "hideout",
      durationSeconds: 2,
      id: "a-first-hideout",
      label: "A First Hideout",
      offsetSeconds: 1,
    }),
    createEditorRecordingBookmark({
      category: "map",
      durationSeconds: 8,
      id: "a-crossing",
      label: "A Crossing",
      offsetSeconds: 5,
    }),
    createEditorRecordingBookmark({
      category: "manual",
      id: "a-manual",
      label: "A Manual",
      offsetSeconds: 22,
    }),
    createEditorRecordingBookmark({
      category: "death",
      id: "a-death",
      label: "A Death",
      offsetSeconds: 30,
      sceneName: "A Death Scene",
    }),
    createEditorRecordingBookmark({
      category: "boss",
      durationSeconds: 5,
      id: "a-late-boss",
      label: "A Late Boss",
      offsetSeconds: 45,
    }),
  ];
  const recordingBBookmarks = [
    createEditorRecordingBookmark({
      category: "hideout",
      durationSeconds: 3,
      id: "b-hideout",
      label: "B Hideout",
      offsetSeconds: 2,
    }),
    createEditorRecordingBookmark({
      category: "map",
      durationSeconds: 3,
      id: "b-map",
      label: "B Map",
      offsetSeconds: 6,
    }),
    createEditorRecordingBookmark({
      category: "manual",
      id: "b-manual",
      label: "B Manual",
      offsetSeconds: 10,
    }),
    createEditorRecordingBookmark({
      category: "death",
      id: "b-death",
      label: "B Death",
      offsetSeconds: 14,
      sceneName: "B Death Scene",
    }),
    createEditorRecordingBookmark({
      category: "town",
      durationSeconds: 3,
      id: "b-town",
      label: "B Town",
      offsetSeconds: 18,
    }),
    createEditorRecordingBookmark({
      category: "boss",
      durationSeconds: 3,
      id: "b-boss",
      label: "B Boss",
      offsetSeconds: 22,
    }),
  ];

  await setupEditorE2E(page, {
    extraAssets: [recordingA, recordingB],
    extraProjects: [recordingBookmarkProject],
    initialRoute: "/#/editor?projectId=project-recording-bookmarks",
    recordingBookmarkPages: {
      [recordingA.id]: createEditorRecordingBookmarksPage(recordingABookmarks),
      [recordingB.id]: createEditorRecordingBookmarksPage(recordingBBookmarks),
    },
  });
  await expect(
    page.locator(
      "[data-clip-body='true'][data-clip-id='timeline-recording-a']",
    ),
  ).toBeVisible();
  expect((await getEditorE2ECalls(page)).recordingBookmarkQueries).toEqual([]);

  await page.keyboard.press("ControlOrMeta+B");
  const bookmarksRail = page.locator("aside", {
    has: page.getByRole("heading", { name: "Bookmarks" }),
  });
  await expect(bookmarksRail).toBeVisible();
  await expectBookmarkItemIds(
    page,
    recordingABookmarks.map((bookmark) => bookmark.id),
  );
  await expect(bookmarksRail.getByText("5 items")).toBeVisible();
  await expect
    .poll(async () => (await getEditorE2ECalls(page)).recordingBookmarkQueries)
    .toEqual([
      {
        query: { includeTimeline: true, pageIndex: 0, pageSize: 5 },
        recordingId: recordingA.id,
      },
    ]);

  const allChip = bookmarksRail.locator(
    "[data-bookmark-category-chip='__all__']",
  );
  const mapChip = bookmarksRail.locator("[data-bookmark-category-chip='map']");
  await expect(allChip).toHaveAttribute("aria-pressed", "false");
  await allChip.click();
  await expect(allChip).toHaveAttribute("aria-pressed", "true");
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-crossing']"),
  ).toBeVisible();
  await allChip.click();
  await expect(allChip).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-crossing']"),
  ).toHaveCount(0);

  await mapChip.click();
  await expect(mapChip).toHaveAttribute("aria-pressed", "true");
  await expectBookmarkItemIds(page, ["a-crossing"]);
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-crossing']"),
  ).toBeVisible();
  await mapChip.click();
  await expect(mapChip).toHaveAttribute("aria-pressed", "false");
  await expectBookmarkItemIds(
    page,
    recordingABookmarks.map((bookmark) => bookmark.id),
  );

  const crossingItem = bookmarksRail.locator(
    "[data-recording-bookmark-panel-item-id='a-crossing']",
  );
  await crossingItem.hover();
  await expect(
    page.locator("[data-recording-timeline-hover-segment-id='a-crossing']"),
  ).toBeVisible();
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-crossing']"),
  ).toBeVisible();
  await crossingItem.click();
  await expect(crossingItem).toHaveAttribute("aria-pressed", "true");
  await page.mouse.move(8, 8);
  await expect(
    page.locator("[data-recording-timeline-hover-segment-id='a-crossing']"),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(crossingItem).toHaveAttribute("aria-pressed", "false");
  await expect(
    page.locator("[data-recording-timeline-hover-segment-id='a-crossing']"),
  ).toHaveCount(0);

  await allChip.click();
  await dragTrimHandleBySourceSeconds(page, {
    clipId: clipA.id,
    edge: "end",
    seconds: 25,
  });
  await expectBookmarkItemIds(page, [
    "a-first-hideout",
    "a-crossing",
    "a-manual",
    "a-death",
  ]);
  await expect(bookmarksRail.getByText("4 items")).toBeVisible();
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-late-boss']"),
  ).toHaveCount(0);

  await bookmarksRail
    .locator("[data-recording-bookmark-panel-item-id='a-crossing']")
    .click();
  await dragTrimHandleBySourceSeconds(page, {
    clipId: clipA.id,
    edge: "start",
    seconds: 8,
  });
  await expectBookmarkItemIds(page, [
    "a-first-hideout",
    "a-crossing",
    "a-manual",
    "a-death",
  ]);
  await expect(bookmarksRail.getByText("4 items")).toBeVisible();
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-crossing']"),
  ).toHaveCount(1);
  await expect(
    page.locator("[data-recording-timeline-hover-segment-id='a-crossing']"),
  ).toBeVisible();

  await page
    .locator("[data-clip-body='true'][data-clip-id='timeline-recording-b']")
    .click();
  await expect(
    page.locator("[data-recording-timeline-hover-segment-id='a-crossing']"),
  ).toHaveCount(0);
  await expectBookmarkItemIds(page, [
    "b-boss",
    "b-town",
    "b-death",
    "b-manual",
    "b-map",
  ]);
  await expect(bookmarksRail.getByText("6 items")).toBeVisible();
  await expect(bookmarksRail.getByText("1 / 2")).toBeVisible();
  await expect
    .poll(async () =>
      (await getEditorE2ECalls(page)).recordingBookmarkQueries.map(
        (call) => call.recordingId,
      ),
    )
    .toEqual([recordingA.id, recordingB.id]);

  await allChip.click();
  await expect(
    page.locator("[data-recording-bookmark-marker-id='b-hideout']"),
  ).toBeVisible();
  await expect(
    page.locator("[data-recording-bookmark-marker-id='a-manual']"),
  ).toHaveCount(0);
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

  const clipBeforeStartTrim = await readClip(page, "timeline-b");
  await dragLocatorBy(
    page.locator("[data-trim-edge='start'][data-clip-id='timeline-b']"),
    { x: 40, y: 0 },
  );
  await expect
    .poll(async () => {
      const clip = await readClip(page, "timeline-b");

      return clip.startSeconds;
    })
    .toBeGreaterThan(clipBeforeStartTrim.startSeconds);

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

function createEditorRecordingAsset(id: string): EditorMediaAsset {
  return {
    ...createEditorE2EAsset({
      category: "recording",
      id,
      kind: "recording",
      name: `${id}.mp4`,
      subtitle: "Recording - Standard",
    }),
    durationSeconds: 120,
  };
}

function createEditorRecordingClip(
  asset: EditorMediaAsset,
  input: {
    durationSeconds: number;
    id: string;
    startSeconds: number;
  },
): EditorTimelineClip {
  return {
    assetKey: asset.assetKey,
    color: "primary",
    durationSeconds: input.durationSeconds,
    id: input.id,
    inSeconds: 0,
    mediaUrl: asset.mediaUrl,
    name: asset.name,
    outSeconds: input.durationSeconds,
    playbackRate: 1,
    sourceInSeconds: 0,
    sourceOutSeconds: asset.durationSeconds ?? input.durationSeconds,
    startSeconds: input.startSeconds,
    trackId: "video-track",
  };
}

function createEditorRecordingBookmark(input: {
  category: BookmarkCategory;
  durationSeconds?: number | null;
  id: string;
  label: string;
  offsetSeconds: number;
  sceneName?: string | null;
}): RecordingBookmark {
  const occurredAt = new Date(
    Date.parse("2026-07-04T10:00:00.000Z") + input.offsetSeconds * 1_000,
  ).toISOString();

  return {
    category: input.category,
    createdAt: occurredAt,
    durationSeconds: input.durationSeconds ?? null,
    id: input.id,
    label: input.label,
    note: null,
    occurredAt,
    offsetSeconds: input.offsetSeconds,
    sceneName: input.sceneName ?? null,
    source: input.category === "manual" ? "manual" : "client-log",
    sourceGame: "poe2",
    sourceLeague: "Standard",
    subcategory: null,
    updatedAt: occurredAt,
  };
}

function createEditorRecordingBookmarksPage(
  bookmarks: RecordingBookmark[],
): RecordingBookmarksPage {
  const pageSize = 5;

  return {
    availableCategories: Array.from(
      new Set(bookmarks.map((bookmark) => bookmark.category)),
    ),
    items: bookmarks.slice(0, pageSize),
    pageCount: Math.max(1, Math.ceil(bookmarks.length / pageSize)),
    pageIndex: 0,
    pageSize,
    timelineItems: bookmarks,
    timelineItemsTruncated: false,
    totalCount: bookmarks.length,
  };
}

async function dragTrimHandleBySourceSeconds(
  page: Page,
  input: {
    clipId: string;
    edge: "end" | "start";
    seconds: number;
  },
) {
  const x = await page.evaluate(({ clipId, edge, seconds }) => {
    const clip = document.querySelector<HTMLElement>(
      `[data-clip-body='true'][data-clip-id='${clipId}']`,
    );
    if (!clip) {
      throw new Error(`Timeline clip ${clipId} was not rendered`);
    }

    const durationSeconds = Number(clip.dataset.clipDurationSeconds);
    const widthPixels = clip.getBoundingClientRect().width;
    const offsetPixels = widthPixels * (seconds / durationSeconds);

    return edge === "start" ? offsetPixels : -offsetPixels;
  }, input);

  await dragLocatorBy(
    page.locator(
      `[data-trim-edge='${input.edge}'][data-clip-id='${input.clipId}']`,
    ),
    { x, y: 0 },
  );
}

async function expectBookmarkItemIds(page: Page, expectedIds: string[]) {
  await expect
    .poll(async () => (await readBookmarkItemIds(page)).sort())
    .toEqual([...expectedIds].sort());
}

async function readBookmarkItemIds(page: Page): Promise<string[]> {
  return page
    .locator("[data-recording-bookmark-panel-item-id]")
    .evaluateAll((nodes) =>
      nodes.map(
        (node) =>
          (node as HTMLElement).dataset.recordingBookmarkPanelItemId ?? "",
      ),
    );
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
