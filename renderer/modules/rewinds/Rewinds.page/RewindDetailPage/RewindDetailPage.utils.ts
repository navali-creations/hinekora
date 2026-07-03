import type {
  ActivitySessionBookmark,
  ActivitySessionClip,
  ActivitySessionTimeline,
  BookmarkCategory,
  RecordingBookmark,
} from "~/main/modules/bookmarks";

type RewindClipTargetsByBookmarkId = Record<
  string,
  { targetDurationSeconds: number | null; targetId: string }
>;

interface RewindClipSegment {
  endSeconds: number;
  startSeconds: number;
}

const rewindLocationCategories = new Set<BookmarkCategory>([
  "boss",
  "hideout",
  "map",
  "pinnacle",
  "town",
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
    ...timeline.clips.map((clip) => clip.offsetSeconds ?? 0),
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
        durationSeconds: clipTarget.targetDurationSeconds,
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
    (clip.targetDurationSeconds ?? 0) - visibleDurationSeconds,
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

  const endSeconds = Math.max(0, clip.offsetSeconds);
  const startSeconds = Math.max(0, endSeconds - clip.targetDurationSeconds);

  return { endSeconds, startSeconds };
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

function isRewindLocationBookmark(bookmark: ActivitySessionBookmark): boolean {
  return (
    rewindLocationCategories.has(bookmark.category) &&
    typeof bookmark.offsetSeconds === "number" &&
    Number.isFinite(bookmark.offsetSeconds)
  );
}

export {
  calculateRewindDurationSeconds,
  findRewindClipAtSeconds,
  mapRewindTimelineBookmarks,
  resolveRewindClipLocalSeconds,
  resolveRewindClipSegment,
  resolveRewindClipVisualOffsetSeconds,
};
