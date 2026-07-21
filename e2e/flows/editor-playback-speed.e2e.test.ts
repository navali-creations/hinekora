import { expect, type Page, test } from "@playwright/test";

import {
  type EditorTimelinePlaybackRate,
  editorTimelinePlaybackRates,
} from "../../types";
import {
  expectNoUnexpectedEditorBridgeCalls,
  getEditorE2ECalls,
  openEditorActionsMenu,
  setupEditorE2E,
  waitForSavedProjectCount,
} from "../helpers/editor-fixture";

const playbackRateTimelineCases = [
  {
    clipIds: ["timeline-second"],
    name: "single clip",
    projectId: "project-2",
  },
  {
    clipIds: ["timeline-a", "timeline-b", "timeline-c"],
    name: "multiple clips",
    projectId: "project-1",
  },
] as const;

test.describe("editor playback speed exports", () => {
  test.describe.configure({ mode: "parallel" });

  test.afterEach(async ({ page }) => {
    await expectNoUnexpectedEditorBridgeCalls(page);
  });

  test("keeps editor shortcuts isolated while the speed menu has focus", async ({
    page,
  }) => {
    await setupEditorE2E(page);
    const selectedClip = page.locator(
      "[data-clip-body='true'][data-clip-id='timeline-a']",
    );
    await selectedClip.click();
    await page.getByLabel("Clip speed: 1x").click();
    await expect(
      page.getByRole("menuitemradio", { name: "1x", exact: true }),
    ).toBeFocused();

    await page.keyboard.press("Delete");

    await expect(selectedClip).toBeVisible();
    await expect(page.getByLabel("Clip speed options")).toBeVisible();

    await page.keyboard.press("Escape");
    await expect(page.getByLabel("Clip speed options")).toHaveCount(0);
    await expect(selectedClip).toBeVisible();
  });

  for (const playbackRate of editorTimelinePlaybackRates) {
    for (const timelineCase of playbackRateTimelineCases) {
      test(`${timelineCase.name} at ${playbackRate}x autosaves and exports valid clip data`, async ({
        page,
      }) => {
        await setupEditorE2E(page);
        await page
          .getByLabel("Editor project")
          .selectOption(timelineCase.projectId);

        for (const clipId of timelineCase.clipIds) {
          await setTimelineClipPlaybackRate(page, clipId, playbackRate);
        }
        await waitForSavedProjectCount(page, 1);

        await openEditorActionsMenu(page);
        await page
          .getByRole("button", { name: "Save Ctrl S", exact: true })
          .click();
        await expect(
          page.getByRole("heading", { name: "Save video" }),
        ).toBeVisible();
        await page.getByRole("button", { name: "Save video" }).click();
        await expect
          .poll(
            async () => (await getEditorE2ECalls(page)).exportRequests.length,
          )
          .toBe(1);

        const calls = await getEditorE2ECalls(page);
        const savedClips = calls.savedProjects.at(-1)?.tracks[0]?.clips ?? [];
        const exportRequest = calls.exportRequests.at(-1);
        if (!exportRequest) {
          throw new Error("Expected an editor export request");
        }

        expect(savedClips.map((clip) => clip.id)).toEqual(timelineCase.clipIds);
        expect(
          savedClips.every((clip) => clip.playbackRate === playbackRate),
        ).toBe(true);
        const exportedClips = exportRequest.project.tracks[0]?.clips ?? [];
        expect(exportedClips).toHaveLength(timelineCase.clipIds.length);
        expect(
          exportedClips.every((clip) => clip.playbackRate === playbackRate),
        ).toBe(true);
        expectValidPlaybackRateClips(exportedClips, playbackRate);
        expect(exportRequest.project.durationSeconds).toBe(
          Math.max(
            ...exportedClips.map(
              (clip) => clip.startSeconds + clip.durationSeconds,
            ),
          ),
        );
      });
    }
  }
});

async function setTimelineClipPlaybackRate(
  page: Page,
  clipId: string,
  playbackRate: EditorTimelinePlaybackRate,
) {
  await page
    .locator(`[data-clip-body='true'][data-clip-id='${clipId}']`)
    .click();

  if (playbackRate === 1) {
    await choosePlaybackRate(page, 1, 2);
    await choosePlaybackRate(page, 2, 1);
    return;
  }

  await choosePlaybackRate(page, 1, playbackRate);
}

async function choosePlaybackRate(
  page: Page,
  currentPlaybackRate: EditorTimelinePlaybackRate,
  nextPlaybackRate: EditorTimelinePlaybackRate,
) {
  await page.getByLabel(`Clip speed: ${currentPlaybackRate}x`).click();
  await page
    .getByRole("menuitemradio", { name: `${nextPlaybackRate}x`, exact: true })
    .click();
  await expect(
    page.getByLabel(`Clip speed: ${nextPlaybackRate}x`),
  ).toBeVisible();
}

function expectValidPlaybackRateClips(
  clips: Array<{
    durationSeconds: number;
    inSeconds: number;
    outSeconds: number;
    playbackRate: EditorTimelinePlaybackRate;
    startSeconds: number;
  }>,
  playbackRate: EditorTimelinePlaybackRate,
) {
  let cursorSeconds = 0;
  for (const clip of clips) {
    const expectedDurationSeconds = roundToMilliseconds(
      (clip.outSeconds - clip.inSeconds) / playbackRate,
    );

    expect(Number.isFinite(clip.durationSeconds)).toBe(true);
    expect(clip.durationSeconds).toBeGreaterThan(0);
    expect(clip.durationSeconds).toBe(expectedDurationSeconds);
    expect(clip.startSeconds).toBeGreaterThanOrEqual(cursorSeconds);
    cursorSeconds = roundToMilliseconds(
      clip.startSeconds + clip.durationSeconds,
    );
  }
}

function roundToMilliseconds(seconds: number): number {
  return Math.round(seconds * 1_000) / 1_000;
}
