import { useEffect, useMemo, useState } from "react";

import {
  createClipThumbnails,
  createThumbnailCacheKey,
} from "./useEditorClipThumbnails.utils";

const thumbnailWidthPixels = 96;
const maxThumbnails = 8;
const maxThumbnailCacheEntries = 80;
const thumbnailLoadDelayMs = 250;

const thumbnailCache = new Map<string, string[]>();
const thumbnailRequests = new Map<string, Promise<string[]>>();
let thumbnailQueue: Promise<unknown> = Promise.resolve();

interface UseEditorClipThumbnailsInput {
  durationSeconds: number;
  inSeconds: number;
  mediaUrl: string | null;
  outSeconds: number;
  widthPixels: number;
}

function useEditorClipThumbnails({
  durationSeconds,
  inSeconds,
  mediaUrl,
  outSeconds,
  widthPixels,
}: UseEditorClipThumbnailsInput): string[] {
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  const thumbnailCount = useMemo(
    () => calculateEditorThumbnailCount(widthPixels),
    [widthPixels],
  );

  useEffect(() => {
    if (!mediaUrl || thumbnailCount <= 0 || durationSeconds <= 0) {
      setThumbnails([]);
      return;
    }

    const cacheKey = createThumbnailCacheKey({
      count: thumbnailCount,
      inSeconds,
      mediaUrl,
      outSeconds,
    });
    const cachedThumbnails = thumbnailCache.get(cacheKey);
    if (cachedThumbnails) {
      setThumbnails(cachedThumbnails);
      return;
    }

    let isCancelled = false;
    const timeoutId = window.setTimeout(() => {
      const loadThumbnails = async () => {
        const nextThumbnails = await queueClipThumbnails(
          cacheKey,
          {
            count: thumbnailCount,
            inSeconds,
            mediaUrl,
            outSeconds,
          },
          () => isCancelled,
        );
        if (!isCancelled && nextThumbnails.length > 0) {
          cacheThumbnails(cacheKey, nextThumbnails);
          setThumbnails(nextThumbnails);
        }
      };

      void loadThumbnails().catch(() => {
        if (!isCancelled) {
          setThumbnails([]);
        }
      });
    }, thumbnailLoadDelayMs);

    return () => {
      isCancelled = true;
      window.clearTimeout(timeoutId);
    };
  }, [durationSeconds, inSeconds, mediaUrl, outSeconds, thumbnailCount]);

  return thumbnails;
}

function calculateEditorThumbnailCount(widthPixels: number): number {
  if (!Number.isFinite(widthPixels) || widthPixels <= 0) {
    return 0;
  }

  return Math.min(
    Math.max(Math.ceil(widthPixels / thumbnailWidthPixels), 1),
    maxThumbnails,
  );
}

function queueClipThumbnails(
  cacheKey: string,
  input: {
    count: number;
    inSeconds: number;
    mediaUrl: string;
    outSeconds: number;
  },
  isCancelled: () => boolean,
): Promise<string[]> {
  const currentRequest = thumbnailRequests.get(cacheKey);
  if (currentRequest) {
    return currentRequest;
  }

  const task = thumbnailQueue
    .catch(() => undefined)
    .then(() => (isCancelled() ? [] : createClipThumbnails(input, isCancelled)))
    .finally(() => {
      thumbnailRequests.delete(cacheKey);
    });
  thumbnailRequests.set(cacheKey, task);
  thumbnailQueue = task.catch(() => undefined);

  return task;
}

function cacheThumbnails(cacheKey: string, thumbnails: string[]) {
  thumbnailCache.set(cacheKey, thumbnails);
  if (thumbnailCache.size <= maxThumbnailCacheEntries) {
    return;
  }

  const oldestKey = thumbnailCache.keys().next().value;
  if (oldestKey) {
    thumbnailCache.delete(oldestKey);
  }
}

export { calculateEditorThumbnailCount, useEditorClipThumbnails };
