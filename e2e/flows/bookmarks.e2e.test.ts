import { expect, type Page, test } from "@playwright/test";

import type {
  BookmarkCategory,
  BookmarkLibraryItem,
} from "../../main/modules/bookmarks";
import {
  expectNoUnexpectedDashboardBridgeCalls,
  getDashboardE2ECalls,
  setupDashboardE2E,
} from "../helpers/dashboard-fixture";
import {
  clickTimelineAt,
  minutesAfterTimelineFixtureBase,
} from "../helpers/timeline-fixture";

test.afterEach(async ({ page }) => {
  await expectNoUnexpectedDashboardBridgeCalls(page);
});

function createBookmark(
  overrides: Partial<BookmarkLibraryItem> & {
    category: BookmarkCategory;
    id: string;
    label: string;
  },
): BookmarkLibraryItem {
  const { category, id, label, ...rest } = overrides;
  const occurredAt = overrides.occurredAt ?? minutesAfterTimelineFixtureBase(0);

  return {
    activeActivitySessionBookmarkDurationSeconds: null,
    activeActivitySessionDurationSeconds: null,
    activeActivitySessionId: null,
    activeActivitySessionOffsetSeconds: null,
    activeRecordingBookmarkDurationSeconds: null,
    activeRecordingDurationSeconds: null,
    activeRecordingId: null,
    activeRecordingOffsetSeconds: null,
    archivedRecordingBookmarkDurationSeconds: null,
    archivedRecordingDurationSeconds: null,
    archivedRecordingId: null,
    archivedRecordingTitle: null,
    category,
    createdAt: occurredAt,
    id,
    label,
    note: null,
    occurredAt,
    sceneName: overrides.sceneName ?? label,
    source: category === "manual" ? "manual" : "client-log",
    sourceGame: "poe2",
    sourceLeague: "Runes of Aldur",
    subcategory: null,
    updatedAt: occurredAt,
    ...rest,
  };
}

function createRecordingBookmark(
  id: string,
  offsetSeconds: number,
  category: BookmarkCategory,
  label: string,
): BookmarkLibraryItem {
  const occurredAt = minutesAfterTimelineFixtureBase(offsetSeconds / 60);

  return createBookmark({
    activeRecordingBookmarkDurationSeconds:
      category === "manual" ? null : Math.max(1, 90 - offsetSeconds),
    activeRecordingDurationSeconds: 90,
    activeRecordingId: "recording-detail-1",
    activeRecordingOffsetSeconds: offsetSeconds,
    category,
    id,
    label,
    occurredAt,
    sceneName: category === "death" ? "Qimah Reservoir" : label,
    source: category === "manual" ? "manual" : "client-log",
    updatedAt: minutesAfterTimelineFixtureBase(90 / 60),
  });
}

async function getLastBookmarkLibraryQuery(page: Page) {
  const queries = (await getDashboardE2ECalls(page)).bookmarkLibraryQueries;
  const query = queries.at(-1);

  return {
    category: query?.category,
    game: query?.game,
    league: query?.league,
    pageIndex: query?.pageIndex,
  };
}

test("covers bookmark table pagination, sorting, filters, separators, and row actions", async ({
  page,
}) => {
  const bookmarks: BookmarkLibraryItem[] = [
    createBookmark({
      activeActivitySessionBookmarkDurationSeconds: 12,
      activeActivitySessionDurationSeconds: 140,
      activeActivitySessionId: "rewind-new",
      activeActivitySessionOffsetSeconds: 120,
      category: "hideout",
      id: "separator-rewind-new",
      label: "Atlas Hideout",
      occurredAt: minutesAfterTimelineFixtureBase(130),
    }),
    createBookmark({
      activeActivitySessionBookmarkDurationSeconds: 20,
      activeActivitySessionDurationSeconds: 120,
      activeActivitySessionId: "rewind-old",
      activeActivitySessionOffsetSeconds: 80,
      category: "map",
      id: "separator-rewind-old",
      label: "Sanctuary",
      occurredAt: minutesAfterTimelineFixtureBase(129),
    }),
    createBookmark({
      activeRecordingBookmarkDurationSeconds: 45,
      activeRecordingDurationSeconds: 180,
      activeRecordingId: "recording-new",
      activeRecordingOffsetSeconds: 60,
      category: "death",
      id: "separator-recording-new",
      label: "Death",
      occurredAt: minutesAfterTimelineFixtureBase(128),
      sceneName: "Kriar Village",
    }),
    createBookmark({
      activeRecordingBookmarkDurationSeconds: 60,
      activeRecordingDurationSeconds: 180,
      activeRecordingId: "recording-old",
      activeRecordingOffsetSeconds: 40,
      category: "boss",
      id: "separator-recording-old",
      label: "Absence of Symmetry and Harmony",
      occurredAt: minutesAfterTimelineFixtureBase(127),
    }),
    createBookmark({
      activeActivitySessionBookmarkDurationSeconds: 18,
      activeActivitySessionDurationSeconds: 150,
      activeActivitySessionId: "rewind-third",
      activeActivitySessionOffsetSeconds: 50,
      category: "rewind-manual-replay",
      id: "separator-rewind-third",
      label: "Manual replay",
      occurredAt: minutesAfterTimelineFixtureBase(126),
      source: "system",
    }),
    createBookmark({
      category: "manual",
      id: "manual-rename-delete",
      label: "Memorable moment",
      occurredAt: minutesAfterTimelineFixtureBase(125),
      sceneName: "Qimah Reservoir",
      source: "manual",
    }),
    createBookmark({
      category: "town",
      id: "standard-poe2",
      label: "The Khari Bazaar",
      occurredAt: minutesAfterTimelineFixtureBase(124),
      sourceLeague: "Standard",
    }),
    createBookmark({
      category: "map",
      id: "poe1-standard",
      label: "Highgate",
      occurredAt: minutesAfterTimelineFixtureBase(123),
      sourceGame: "poe1",
      sourceLeague: "Mirage",
    }),
    ...Array.from({ length: 16 }, (_, index) =>
      createBookmark({
        activeRecordingBookmarkDurationSeconds: 30,
        activeRecordingDurationSeconds: 180,
        activeRecordingId: "recording-fill",
        activeRecordingOffsetSeconds: index + 1,
        category: "map",
        id: `pagination-fill-${index + 1}`,
        label: `Pagination filler ${String(index + 1).padStart(2, "0")}`,
        occurredAt: minutesAfterTimelineFixtureBase(90 - index),
      }),
    ),
  ];

  await setupDashboardE2E(page, { bookmarks });
  await page.getByRole("link", { name: "Bookmarks" }).click();

  await expect(page.getByRole("heading", { name: "Bookmarks" })).toBeVisible();
  await expect(page.getByText("Showing 1 to 20 of 22 results")).toBeVisible();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();
  await expect(page.getByText("Start of new Rewind").first()).toBeVisible();
  await expect(page.getByText("End of previous Rewind").first()).toBeVisible();
  await expect(
    page.getByText("End of previous Recording").first(),
  ).toBeVisible();
  await expect(page.getByText("Start of new Recording").first()).toBeVisible();

  const gradientRow = page
    .locator("tbody tr")
    .filter({ hasText: "Atlas Hideout" })
    .first();
  await expect(gradientRow).toBeVisible();
  await expect
    .poll(() =>
      gradientRow.evaluate((row) => {
        const cells = Array.from(row.querySelectorAll("td"));
        const headers = Array.from(
          row.closest("table")?.querySelectorAll("thead th") ?? [],
        );
        return {
          backgroundImage: getComputedStyle(row).backgroundImage,
          cellsAreTransparent: cells.every(
            (cell) =>
              getComputedStyle(cell).backgroundColor === "rgba(0, 0, 0, 0)",
          ),
          columnsAreAligned: cells.every((cell, index) => {
            const header = headers[index];
            return (
              header !== undefined &&
              Math.abs(
                cell.getBoundingClientRect().left -
                  header.getBoundingClientRect().left,
              ) <= 1
            );
          }),
        };
      }),
    )
    .toEqual({
      backgroundImage: expect.stringContaining("linear-gradient"),
      cellsAreTransparent: true,
      columnsAreAligned: true,
    });

  await page.getByRole("button", { name: "Next page" }).click();
  await expect(page.getByText("Page 2 of 2")).toBeVisible();
  await expect(page.getByText("Showing 21 to 22 of 22 results")).toBeVisible();
  await page.getByRole("button", { name: "Previous page" }).click();
  await expect(page.getByText("Page 1 of 2")).toBeVisible();

  await page.getByRole("button", { name: /^Label/ }).click();
  await expect(
    page.getByText("Absence of Symmetry and Harmony").first(),
  ).toBeVisible();
  await expect(page.getByText("Start of new Rewind")).toBeHidden();
  await page.getByRole("button", { name: /^Time/ }).click();
  await page.getByRole("button", { name: /^Time/ }).click();
  await expect(page.getByText("Start of new Rewind").first()).toBeVisible();

  await page.getByLabel("Library league").selectOption("Standard");
  await expect(page.getByText("The Khari Bazaar").first()).toBeVisible();
  await expect(page.getByText("Atlas Hideout")).toBeHidden();
  await expect
    .poll(async () => getLastBookmarkLibraryQuery(page))
    .toEqual({
      category: undefined,
      game: "poe2",
      league: "Standard",
      pageIndex: 0,
    });
  await page.getByLabel("Library league").selectOption("__all__");
  await expect(
    page.getByRole("columnheader", { name: "League" }),
  ).toBeVisible();
  await expect(page.getByText("Atlas Hideout").first()).toBeVisible();
  await expect
    .poll(async () => getLastBookmarkLibraryQuery(page))
    .toEqual({
      category: undefined,
      game: "poe2",
      league: undefined,
      pageIndex: 0,
    });

  await page.getByRole("button", { name: /Path of Exile 1/ }).click();
  await expect(page.getByText("Highgate").first()).toBeVisible();
  await expect(page.getByText("Atlas Hideout")).toBeHidden();
  await expect
    .poll(async () => getLastBookmarkLibraryQuery(page))
    .toEqual({
      category: undefined,
      game: "poe1",
      league: "Mirage",
      pageIndex: 0,
    });
  await page.getByRole("button", { name: /Path of Exile 2/ }).click();
  await expect(page.getByText("Atlas Hideout").first()).toBeVisible();

  await page
    .getByRole("link", { name: "Open attached rewind" })
    .first()
    .click();
  await expect(page).toHaveURL(/\/rewind\/rewind-new\?t=120$/);
  await page.getByRole("link", { name: "Bookmarks" }).click();

  await page
    .getByRole("button", { name: /Death.*Kriar Village.*1:00/ })
    .click();
  await expect(page).toHaveURL(/\/recording\/recording-new\?t=60$/);
  await page.getByRole("link", { name: "Bookmarks" }).click();

  await page.getByRole("button", { exact: true, name: "Manual" }).click();
  await page.getByRole("button", { name: "Rename bookmark" }).click();
  await expect(
    page.getByRole("heading", { name: "Rename bookmark" }),
  ).toBeVisible();
  await page.getByLabel("Bookmark label").fill("Boss skip setup");
  await page.getByRole("button", { exact: true, name: "Rename" }).click();
  await expect(page.getByText("Boss skip setup")).toBeVisible();

  await expect
    .poll(async () => (await getDashboardE2ECalls(page)).bookmarkUpdates)
    .toEqual([{ id: "manual-rename-delete", label: "Boss skip setup" }]);

  await page.getByRole("button", { name: "Delete bookmark" }).click();
  await expect(page.getByText("Boss skip setup")).toBeHidden();
  await expect
    .poll(async () => (await getDashboardE2ECalls(page)).bookmarkDeletes)
    .toEqual(["manual-rename-delete"]);
});

test("covers recording detail playback, timeline seeking, bookmark pagination, and back navigation", async ({
  page,
}) => {
  const bookmarks = [
    createRecordingBookmark("recording-map-0", 0, "map", "Qimah Reservoir"),
    createRecordingBookmark("recording-death-12", 12, "death", "Death"),
    createRecordingBookmark(
      "recording-manual-24",
      24,
      "manual",
      "Manual bookmark",
    ),
    createRecordingBookmark(
      "recording-hideout-36",
      36,
      "hideout",
      "Atlas Hideout",
    ),
    createRecordingBookmark("recording-boss-48", 48, "boss", "Trialmaster"),
    createRecordingBookmark(
      "recording-town-60",
      60,
      "town",
      "The Khari Bazaar",
    ),
  ];

  await setupDashboardE2E(page, { bookmarks });
  await page.goto("/#/recording/recording-detail-1");
  const openingBookmark = page.locator(
    '[data-recording-bookmark-panel-item-id="recording-map-0"]',
  );

  await expect(
    page.getByRole("heading", { name: "recording-detail-1.mp4" }),
  ).toBeVisible();
  await expect(page.getByText("6 items")).toBeVisible();
  await expect(page.getByText("1 / 2")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /The Khari Bazaar/ }),
  ).toBeVisible();
  await expect(openingBookmark).toBeHidden();

  await page.getByRole("button", { name: "Next bookmark page" }).click();
  await expect(page.getByText("2 / 2")).toBeVisible();
  await expect(openingBookmark).toBeVisible();
  await expect(openingBookmark).toContainText("Qimah Reservoir");
  await expect(openingBookmark).toContainText("0:00");
  await page.getByRole("button", { name: "Previous bookmark page" }).click();
  await expect(page.getByText("1 / 2")).toBeVisible();

  await page.getByRole("button", { exact: true, name: "Death" }).click();
  await expect(page.getByText("1 items")).toBeVisible();
  await expect(
    page.getByRole("button", { name: /Qimah Reservoir.*0:12/ }),
  ).toBeVisible();
  await page.getByRole("button", { exact: true, name: "All" }).click();

  await page.getByRole("button", { name: /Trialmaster.*0:48/ }).click();
  await expect(page.getByText("0:48.00 / 1:30.00")).toBeVisible();
  await expect(
    page.locator('[title="Boss - Trialmaster at 0:48.00"]'),
  ).toBeVisible();

  await page.getByRole("button", { name: "Seek backward 5 seconds" }).click();
  await expect(page.getByText("0:43.00 / 1:30.00")).toBeVisible();
  await page.getByRole("button", { name: "Seek forward 5 seconds" }).click();
  await expect(page.getByText("0:48.00 / 1:30.00")).toBeVisible();
  await page.getByRole("button", { name: "Jump to start" }).click();
  await expect(page.getByText("0:00.00 / 1:30.00")).toBeVisible();

  await clickTimelineAt(page, 0.5);
  await expect(page.getByText(/0:4[3-7]\.\d{2} \/ 1:30\.00/)).toBeVisible();
  await page.getByLabel("Recording volume").fill("0.25");
  await expect(page.getByLabel("Recording volume")).toHaveValue("0.25");

  await page.getByRole("button", { name: "Go back" }).click();
  await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
});
