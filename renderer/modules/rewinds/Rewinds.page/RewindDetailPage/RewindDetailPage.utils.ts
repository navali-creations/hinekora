import {
  type ActivitySessionBookmark,
  type ActivitySessionClip,
  type ActivitySessionTimeline,
  type BookmarkCategory,
  locationBookmarkCategories,
  type RecordingBookmark,
} from "~/main/modules/bookmarks/Bookmarks.dto";
import {
  allRecordingBookmarkCategoriesValue,
  type RecordingBookmarkCategoryFilter,
} from "~/renderer/modules/recordings/Recordings.page/RecordingDetailPage/RecordingBookmarksPanel/RecordingBookmarksPanel.utils";

type RewindClipTargetsByBookmarkId = Record<
  string,
  {
    durationSeconds: number | null;
    targetDurationSeconds: number | null;
    targetId: string;
  }
>;
type RewindTimelineMarkerCategoryFilter =
  | RecordingBookmarkCategoryFilter
  | typeof defaultRewindTimelineMarkerFilterValue;

interface RewindClipSegment {
  endSeconds: number;
  startSeconds: number;
}

const defaultRewindTimelineMarkerFilterValue = "__rewind_default_markers__";
const rewindLocationCategories = new Set<BookmarkCategory>(
  locationBookmarkCategories,
);
const defaultRewindMarkerCategories = new Set<BookmarkCategory>([
  "death",
  "rewind-manual-replay",
]);

function calculateRewindDurationSeconds(
  timeline: ActivitySessionTimeline | null,
): number {
  if (!timeline) {
    return 0;
  }

  const startedAtMs = Date.parse(timeline.session.startedAt);
  const stoppedAtMs = timeline.session.stoppedAt
    ? Date.parse(timeline.session.stoppedAt)
    : Date.now();
  const sessionDurationSeconds =
    Number.isFinite(startedAtMs) && Number.isFinite(stoppedAtMs)
      ? Math.max(0, (stoppedAtMs - startedAtMs) / 1_000)
      : 0;
  const maxBookmarkOffset = Math.max(
    0,
    ...timeline.bookmarks.map((bookmark) => bookmark.offsetSeconds ?? 0),
    ...timeline.clips.map(
      (clip) =>
        resolveRewindClipSegment(clip)?.endSeconds ?? clip.offsetSeconds ?? 0,
    ),
  );

  return Math.max(sessionDurationSeconds, maxBookmarkOffset);
}

function mapRewindTimelineBookmarks(input: {
  bookmarks: ActivitySessionBookmark[];
  clipTargetsByBookmarkId: RewindClipTargetsByBookmarkId;
  durationSeconds: number;
}): RecordingBookmark[] {
  const visibleBookmarks = input.bookmarks.filter(
    (bookmark) => bookmark.category !== "manual",
  );
  const locationOffsets = visibleBookmarks
    .filter(isRewindLocationBookmark)
    .map((bookmark) => bookmark.offsetSeconds as number)
    .sort((firstOffset, secondOffset) => firstOffset - secondOffset);

  return visibleBookmarks.map((bookmark) => {
    const clipTarget = input.clipTargetsByBookmarkId[bookmark.id];
    if (clipTarget) {
      return {
        ...bookmark,
        durationSeconds:
          clipTarget.durationSeconds ?? clipTarget.targetDurationSeconds,
      };
    }

    return {
      ...bookmark,
      durationSeconds: resolveRewindLocationDurationSeconds({
        durationSeconds: input.durationSeconds,
        locationOffsets,
        offsetSeconds: bookmark.offsetSeconds,
        category: bookmark.category,
      }),
    };
  });
}

function filterRewindTimelineMarkerBookmarks(input: {
  bookmarks: RecordingBookmark[];
  categoryFilter: RewindTimelineMarkerCategoryFilter;
}): RecordingBookmark[] {
  if (input.categoryFilter === defaultRewindTimelineMarkerFilterValue) {
    return input.bookmarks.filter((bookmark) =>
      defaultRewindMarkerCategories.has(bookmark.category),
    );
  }

  if (input.categoryFilter === allRecordingBookmarkCategoriesValue) {
    return input.bookmarks;
  }

  return input.bookmarks.filter(
    (bookmark) => bookmark.category === input.categoryFilter,
  );
}

function findRewindClipAtSeconds(
  clips: ActivitySessionClip[],
  seconds: number,
): ActivitySessionClip | null {
  return (
    clips.find((clip) => {
      const segment = resolveRewindClipSegment(clip);

      return (
        segment !== null &&
        seconds >= segment.startSeconds &&
        seconds <= segment.endSeconds
      );
    }) ?? null
  );
}

function findRewindClipForBookmark(
  clips: ActivitySessionClip[],
  bookmark: Pick<RecordingBookmark, "id">,
): ActivitySessionClip | null {
  return clips.find((clip) => clip.bookmarkId === bookmark.id) ?? null;
}

function resolveRewindClipLocalSeconds(
  clip: ActivitySessionClip,
  seconds: number,
): number {
  const segment = resolveRewindClipSegment(clip);
  if (!segment) {
    return 0;
  }

  const visibleDurationSeconds = segment.endSeconds - segment.startSeconds;
  const hiddenLeadingSeconds = Math.max(
    0,
    resolveRewindClipDurationSeconds(clip) - visibleDurationSeconds,
  );

  return Math.min(
    Math.max(hiddenLeadingSeconds + seconds - segment.startSeconds, 0),
    hiddenLeadingSeconds + visibleDurationSeconds,
  );
}

function resolveRewindClipSegment(
  clip: ActivitySessionClip | null,
): RewindClipSegment | null {
  if (
    !clip ||
    clip.offsetSeconds === null ||
    clip.targetDurationSeconds === null ||
    clip.targetDurationSeconds <= 0
  ) {
    return null;
  }

  const clipDurationSeconds = resolveRewindClipDurationSeconds(clip);
  const preRollDurationSeconds = Math.min(
    clip.targetDurationSeconds,
    clipDurationSeconds,
  );
  const startSeconds = Math.max(0, clip.offsetSeconds - preRollDurationSeconds);
  const endSeconds = startSeconds + clipDurationSeconds;

  return { endSeconds, startSeconds };
}

function resolveRewindClipDurationSeconds(
  clip: Pick<ActivitySessionClip, "durationSeconds" | "targetDurationSeconds">,
): number {
  return clip.durationSeconds ?? clip.targetDurationSeconds ?? 0;
}

function resolveRewindLocationDurationSeconds(input: {
  category: BookmarkCategory;
  durationSeconds: number;
  locationOffsets: number[];
  offsetSeconds: number | null;
}): number | null {
  if (
    !rewindLocationCategories.has(input.category) ||
    typeof input.offsetSeconds !== "number" ||
    !Number.isFinite(input.offsetSeconds)
  ) {
    return null;
  }

  const offsetSeconds = input.offsetSeconds;
  const nextOffset = input.locationOffsets.find(
    (offset) => offset > offsetSeconds,
  );
  const segmentEndSeconds = nextOffset ?? input.durationSeconds;

  return Math.max(0, segmentEndSeconds - offsetSeconds);
}

function resolveRewindClipVisualOffsetSeconds(
  clip: ActivitySessionClip | null,
): number {
  const segment = resolveRewindClipSegment(clip);
  if (!clip || !segment) {
    return 0;
  }

  return (
    segment.startSeconds -
    resolveRewindClipLocalSeconds(clip, segment.startSeconds)
  );
}

function resolveRewindBookmarkSeekSeconds(input: {
  bookmark: Pick<RecordingBookmark, "id" | "offsetSeconds">;
  clips: ActivitySessionClip[];
}): number {
  const linkedClipSegment = resolveRewindClipSegment(
    findRewindClipForBookmark(input.clips, input.bookmark),
  );

  if (linkedClipSegment) {
    return linkedClipSegment.startSeconds;
  }

  return input.bookmark.offsetSeconds ?? 0;
}

function isRewindLocationBookmark(bookmark: ActivitySessionBookmark): boolean {
  return (
    rewindLocationCategories.has(bookmark.category) &&
    typeof bookmark.offsetSeconds === "number" &&
    Number.isFinite(bookmark.offsetSeconds)
  );
}

export {
  calculateRewindDurationSeconds,
  defaultRewindTimelineMarkerFilterValue,
  filterRewindTimelineMarkerBookmarks,
  findRewindClipAtSeconds,
  findRewindClipForBookmark,
  mapRewindTimelineBookmarks,
  type RewindTimelineMarkerCategoryFilter,
  resolveRewindBookmarkSeekSeconds,
  resolveRewindClipLocalSeconds,
  resolveRewindClipSegment,
  resolveRewindClipVisualOffsetSeconds,
};
