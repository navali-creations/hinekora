import { expect, test } from "@playwright/test";

import type {
  ActivitySessionBookmark,
  ActivitySessionClip,
  ActivitySessionLibraryItem,
  ActivitySessionTimeline,
  BookmarkCategory,
} from "../../main/modules/bookmarks";
import type { ReplayClipDetail } from "../../main/modules/replay-clips";
import {
  expectNoUnexpectedDashboardBridgeCalls,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";
import {
  clickTimelineAt,
  minutesAfterTimelineFixtureBase,
  secondsAfterTimelineFixtureBase,
} from "../helpers/timeline-fixture";

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString([], {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function createSession(
  id: string,
  minutes: number,
  overrides: Partial<ActivitySessionLibraryItem> = {},
): ActivitySessionLibraryItem {
  const startedAt = minutesAfterTimelineFixtureBase(minutes);
  const durationSeconds = overrides.durationSeconds ?? 90;
  const stoppedAt =
    overrides.stoppedAt === undefined
      ? new Date(Date.parse(startedAt) + durationSeconds * 1_000).toISOString()
      : overrides.stoppedAt;

  return {
    bookmarkCount: 3,
    clipCount: 1,
    createdAt: startedAt,
    durationSeconds,
    id,
    mode: "rewind",
    sourceGame: "poe2",
    sourceLeague: "Runes of Aldur",
    startedAt,
    stoppedAt,
    updatedAt: stoppedAt ?? startedAt,
    ...overrides,
  };
}

function createTimelineBookmark(
  id: string,
  offsetSeconds: number,
  category: BookmarkCategory,
  label: string,
  overrides: Partial<ActivitySessionBookmark> = {},
): ActivitySessionBookmark {
  const occurredAt = secondsAfterTimelineFixtureBase(offsetSeconds);

  return {
    category,
    createdAt: occurredAt,
    id,
    label,
    note: null,
    occurredAt,
    offsetSeconds,
    sceneName: category === "death" ? "Sanctuary" : label,
    source: category === "rewind-manual-replay" ? "system" : "client-log",
    sourceGame: "poe2",
    sourceLeague: "Runes of Aldur",
    subcategory: null,
    updatedAt: occurredAt,
    ...overrides,
  };
}

function createTimelineClip(
  id: string,
  bookmarkId: string,
  offsetSeconds: number,
  targetId: string,
): ActivitySessionClip {
  const createdAt = secondsAfterTimelineFixtureBase(offsetSeconds);

  return {
    activitySessionId: "rewind-detail-1",
    bookmarkId,
    createdAt,
    durationSeconds: 8,
    id,
    offsetSeconds,
    targetDurationSeconds: 20,
    targetId,
    targetKind: "replay-clip",
    updatedAt: createdAt,
  };
}

function createReplayClipDetail(
  id: string,
  kind: "death" | "manual",
): ReplayClipDetail {
  const createdAt = minutesAfterTimelineFixtureBase(60);

  return {
    durationSeconds: 20,
    mediaUrl: `hinekora-media://replay-clip/${id}`,
    clip: {
      createdAt,
      deathTimestamp: createdAt,
      durationSeconds: 20,
      error: null,
      id,
      kind,
      originalObsPath: null,
      processedClipPath: `C:/Hinekora/Death Clips/${id}.mp4`,
      sizeBytes: 2048,
      sourceGame: "poe2",
      sourceLeague: "Runes of Aldur",
      status: "ready",
      targetDurationSeconds: 20,
      triggerLineHash: `${id}-line`,
      updatedAt: createdAt,
    },
  };
}

test("covers rewind table pagination, sorting, filtering, and disabled processing rows", async ({
  page,
}) => {
  const activitySessions: ActivitySessionLibraryItem[] = [
    createSession("rewind-processing", 200, {
      durationSeconds: null,
      stoppedAt: null,
    }),
    ...Array.from({ length: 21 }, (_, index) =>
      createSession(`rewind-runes-${index + 1}`, 190 - index, {
        bookmarkCount: index + 1,
        clipCount: index % 3,
        durationSeconds: 60 + index,
      }),
    ),
    createSession("rewind-standard-poe2", 180, {
      sourceLeague: "Standard",
    }),
    createSession("rewind-standard-poe1", 170, {
      sourceGame: "poe1",
      sourceLeague: "Standard",
    }),
  ];

  await setupDashboardE2E(page, { activitySessions });
  await page
    .getByLabel("Main navigation")
    .getByRole("link", { name: "Rewinds" })
    .click();

  await expect(page.getByRole("heading", { name: "Rewinds" })).toBeVisible();
  await expect(page.getByText("Showing 1 to 20 of 22 results")).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("Processing")).toBeVisible();

  await page.getByText("Processing").click();
  await expect(page).toHaveURL(/\/rewinds$/);

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Showing 21 to 22 of 22 results")).toBeVisible();
  await page.getByRole("button", { name: "Previous page" }).click();

  await page.getByRole("button", { name: /^Started/ }).click();
  await page.getByRole("button", { name: /^Started/ }).click();
  await expect(
    page.getByRole("cell", {
      name: formatDateTime(minutesAfterTimelineFixtureBase(170)),
    }),
  ).toBeVisible();
  await expect(page.getByText("Showing 1 to 20 of 22 results")).toBeVisible();

  await page.getByLabel("Library league").selectOption("Standard");
  await expect(page.getByText("Showing 1 to 1 of 1 results")).toBeVisible();
  await expect(page.getByRole("button", { name: /Saved.*1:30/ })).toBeVisible();
  await page.getByLabel("Library league").selectOption("__all__");
  await expect(
    page.getByRole("columnheader", { name: "League" }),
  ).toBeVisible();

  await page.getByRole("button", { name: /Path of Exile 1/ }).click();
  await expect(page.getByText("Showing 1 to 1 of 1 results")).toBeVisible();
  await page.getByRole("button", { name: /Path of Exile 2/ }).click();
  await page.getByLabel("Library league").selectOption("Runes of Aldur");

  await page.getByRole("button", { name: /Saved/ }).first().click();
  await expect(page).toHaveURL(/\/rewind\/rewind-runes-/);
});

test("covers rewind detail playback, timeline filters, linked clips, bookmark pagination, and back navigation", async ({
  page,
}) => {
  const savedSession = createSession("rewind-detail-1", 0, {
    bookmarkCount: 6,
    clipCount: 2,
    durationSeconds: 120,
  });
  const timeline: ActivitySessionTimeline = {
    bookmarkTimelineItemsTruncated: false,
    bookmarks: [
      createTimelineBookmark("rewind-map-0", 0, "map", "Sanctuary"),
      createTimelineBookmark("rewind-town-20", 20, "town", "Kingsmarch"),
      createTimelineBookmark("rewind-death-35", 35, "death", "Death"),
      createTimelineBookmark(
        "rewind-hideout-55",
        55,
        "hideout",
        "Atlas Hideout",
      ),
      createTimelineBookmark("rewind-boss-80", 80, "boss", "Trialmaster"),
      createTimelineBookmark(
        "rewind-manual-replay-95",
        95,
        "rewind-manual-replay",
        "Manual replay",
        { source: "system" },
      ),
    ],
    clipTimelineItemsTruncated: false,
    clips: [
      createTimelineClip(
        "activity-death-clip",
        "rewind-death-35",
        35,
        "clip-death-1",
      ),
      createTimelineClip(
        "activity-manual-clip",
        "rewind-manual-replay-95",
        95,
        "clip-manual-1",
      ),
    ],
    session: savedSession,
  };
  const replayClipDetails: Record<string, ReplayClipDetail> = {
    "clip-death-1": createReplayClipDetail("clip-death-1", "death"),
    "clip-manual-1": createReplayClipDetail("clip-manual-1", "manual"),
  };

  await setupDashboardE2E(page, {
    activitySessions: [savedSession],
    activitySessionTimelines: { [savedSession.id]: timeline },
    replayClipDetails,
  });
  await page.goto("/#/rewind/rewind-detail-1");

  await expect(page.getByRole("heading", { name: /Rewind/ })).toBeVisible();
  await expect(page.getByText("6 items")).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Manual replay.*1:35/ }),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sanctuary.*0:00/ }),
  ).toBeHidden();

  await page.getByRole("button", { name: "Next bookmark page" }).click();
  await expect(page.getByText("2 / 2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Sanctuary.*0:00/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Previous bookmark page" }).click();

  await expect(
    page.locator('[title="Death - Death at 0:35.00"]'),
  ).toBeVisible();
  await expect(
    page.locator('[title="Manual replay - Manual replay at 1:35.00"]'),
  ).toBeVisible();
  await expect(
    page.locator('[title="Map - Sanctuary at 0:00.00"]'),
  ).toHaveCount(0);

  await page.getByRole("button", { exact: true, name: "Map" }).click();
  await expect(
    page.locator('[title="Map - Sanctuary at 0:00.00"]'),
  ).toBeVisible();
  await expect(page.locator('[title="Death - Death at 0:35.00"]')).toHaveCount(
    0,
  );
  await page.getByRole("button", { exact: true, name: "All" }).click();
  await expect(
    page.locator('[title="Map - Sanctuary at 0:00.00"]'),
  ).toBeVisible();
  await expect(
    page.locator('[title="Death - Death at 0:35.00"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: /Manual replay.*1:35/ }).click();
  await expect(page.locator('video[title="Manual replay"]')).toBeVisible();
  await expect(page.getByText("1:27.00 / 2:00.00")).toBeVisible();
  await expect(
    page.getByRole("link", { exact: true, name: "Edit" }),
  ).toHaveAttribute("href", /\/editor\?id=clip-manual-1&kind=clip$/);

  await page.getByRole("button", { name: "Seek forward 5 seconds" }).click();
  await expect(page.getByText("1:32.00 / 2:00.00")).toBeVisible();
  await page.getByRole("button", { name: "Seek backward 5 seconds" }).click();
  await expect(page.getByText("1:27.00 / 2:00.00")).toBeVisible();
  await page.getByRole("button", { name: "Jump to start" }).click();
  await expect(page.getByText("1:27.00 / 2:00.00")).toBeVisible();
  await page.getByLabel("Recording volume").fill("0.35");
  await expect(page.getByLabel("Recording volume")).toHaveValue("0.35");

  await clickTimelineAt(page, 35 / 120);
  await expect(page.locator('video[title="Death clip"]')).toBeVisible();
  await expect(page.getByText(/0:3[0-5]\.\d{2} \/ 2:00\.00/)).toBeVisible();

  await page.getByRole("main").getByRole("link", { name: "Rewinds" }).click();
  await expect(page).toHaveURL(/\/rewinds$/);
  await expect(page.getByRole("heading", { name: "Rewinds" })).toBeVisible();
});
