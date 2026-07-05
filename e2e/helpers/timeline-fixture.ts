import { expect, type Page } from "@playwright/test";

const timelineFixtureBaseTime = Date.parse("2026-07-04T10:00:00.000Z");

function minutesAfterTimelineFixtureBase(minutes: number): string {
  return new Date(timelineFixtureBaseTime + minutes * 60_000).toISOString();
}

function secondsAfterTimelineFixtureBase(seconds: number): string {
  return new Date(timelineFixtureBaseTime + seconds * 1_000).toISOString();
}

async function clickTimelineAt(page: Page, percent: number) {
  const timeline = page.locator('[data-recording-timeline-grid="true"]');
  await expect(timeline).toBeVisible();
  const box = await timeline.boundingBox();
  expect(box).not.toBeNull();

  await page.mouse.click(
    box!.x + box!.width * percent,
    box!.y + box!.height * 0.35,
  );
}

export {
  clickTimelineAt,
  minutesAfterTimelineFixtureBase,
  secondsAfterTimelineFixtureBase,
  timelineFixtureBaseTime,
};
