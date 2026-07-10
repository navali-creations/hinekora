import { stat } from "node:fs/promises";

import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";

import type { GameId, ReplayClip, ReplayClipKind } from "~/types";
import type {
  ReplayClipLibraryPage,
  ReplayClipLibraryQuery,
  ReplayClipListFilter,
  ReplayClipSourceDetail,
  ReplayClipView,
} from "./ReplayClips.dto";
import { createReplayClipMediaUrl } from "./ReplayClips.media";
import type { ReplayClipsRepository } from "./ReplayClips.repository";

const defaultLibraryPageSize = 20;
const maxReplayClipSizeRepairBatch = 50;
const maxEditorReplayPageValidationCandidates = 100;

interface ReplayClipLibraryDependencies {
  createReplayClipView: (clip: ReplayClip) => ReplayClipView;
  readReplayClipDuration: (path: string | null) => number | null;
  repository: ReplayClipsRepository;
  resolveClipFilePath: (
    path: string | null | undefined,
    options: { requireExistingFile?: boolean; requireNonEmptyFile?: boolean },
  ) => string | null;
  withClipSize: (clip: ReplayClip, persist: boolean) => Promise<ReplayClip>;
}

interface EditorReplayDetailPageInput {
  createdAfter?: string;
  excludeIds?: string[];
  game?: GameId;
  includeIds?: string[];
  kind: ReplayClipKind;
  league?: string;
  pageIndex: number;
  pageSize: number;
}

class ReplayClipLibraryService {
  constructor(private readonly dependencies: ReplayClipLibraryDependencies) {}

  async listEditorReplayDetailPage(
    input: EditorReplayDetailPageInput,
  ): Promise<{ items: ReplayClipSourceDetail[]; totalCount: number }> {
    const filter = createEditorReplayFilter(input);
    const candidateFilter = {
      ...filter,
      mediaPathOnly: true,
      positiveMediaOnly: true,
    };
    const items: ReplayClipSourceDetail[] = [];
    const seenAvailableClipIds = new Set<string>();
    let validatedCandidates = 0;

    while (
      items.length < input.pageSize &&
      validatedCandidates < maxEditorReplayPageValidationCandidates
    ) {
      const page = this.dependencies.repository.listLibraryPage({
        filter: candidateFilter,
        pageIndex: input.pageIndex,
        pageSize: input.pageSize,
        sortBy: "createdAt",
        sortDirection: "desc",
      });
      if (page.items.length === 0) {
        break;
      }

      const candidates = page.items
        .filter((clip) => !seenAvailableClipIds.has(clip.id))
        .slice(
          0,
          maxEditorReplayPageValidationCandidates - validatedCandidates,
        );
      if (candidates.length === 0) {
        break;
      }
      validatedCandidates += candidates.length;
      const resolvedCandidates = await Promise.all(
        candidates.map(async (clip) => ({
          availablePath: await this.resolveAvailableReplayClipPath(clip),
          clip,
        })),
      );
      const missingIds: string[] = [];
      for (const { availablePath, clip } of resolvedCandidates) {
        if (!availablePath) {
          missingIds.push(clip.id);
          continue;
        }
        seenAvailableClipIds.add(clip.id);
        items.push(this.createAvailableReplayClipDetail(clip, availablePath));
        if (items.length >= input.pageSize) {
          break;
        }
      }
      this.dependencies.repository.updateSizes(missingIds, 0);
      if (missingIds.length === 0 || page.items.length < input.pageSize) {
        break;
      }
    }

    return {
      items,
      totalCount: this.dependencies.repository.count(candidateFilter),
    };
  }

  async listLibrary(
    query: ReplayClipLibraryQuery = {},
  ): Promise<ReplayClipLibraryPage> {
    const normalizedQuery = normalizeLibraryQuery(query);
    const filter = libraryQueryToListFilter(normalizedQuery);
    if (normalizedQuery.sortBy === "sizeBytes") {
      await Promise.all(
        this.dependencies.repository
          .listMissingSizeClips(filter, maxReplayClipSizeRepairBatch)
          .map((clip) => this.dependencies.withClipSize(clip, true)),
      );
    }
    const page = this.dependencies.repository.listLibraryPage({
      filter,
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    });
    const items = await Promise.all(
      page.items.map((clip) => this.dependencies.withClipSize(clip, true)),
    );

    return {
      items: items.map(this.dependencies.createReplayClipView),
      availableLeagues: this.dependencies.repository.listLeagues({
        game: normalizedQuery.game,
        kind: normalizedQuery.kind,
      }),
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      pageCount: Math.max(
        1,
        Math.ceil(page.totalCount / normalizedQuery.pageSize),
      ),
      totalCount: page.totalCount,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    };
  }

  private async resolveAvailableReplayClipPath(
    clip: ReplayClip,
  ): Promise<string | null> {
    const path = this.dependencies.resolveClipFilePath(
      clip.processedClipPath ?? clip.originalObsPath,
      { requireExistingFile: false },
    );
    if (!path) {
      return null;
    }
    try {
      const fileStats = await stat(path);
      return fileStats.isFile() && fileStats.size > 0 ? path : null;
    } catch {
      return null;
    }
  }

  private createAvailableReplayClipDetail(
    clip: ReplayClip,
    path: string,
  ): ReplayClipSourceDetail {
    return {
      clip,
      durationSeconds:
        clip.durationSeconds ?? this.dependencies.readReplayClipDuration(path),
      mediaUrl: createReplayClipMediaUrl(clip.id, clip.updatedAt),
    };
  }
}

function createEditorReplayFilter(
  input: EditorReplayDetailPageInput,
): ReplayClipListFilter & {
  createdAfter?: string;
  excludeIds?: string[];
  includeIds?: string[];
} {
  return {
    kind: input.kind,
    ...(input.createdAfter ? { createdAfter: input.createdAfter } : {}),
    ...(input.excludeIds?.length ? { excludeIds: input.excludeIds } : {}),
    ...(input.includeIds?.length ? { includeIds: input.includeIds } : {}),
    ...(input.game ? { game: input.game } : {}),
    ...(input.league ? { league: input.league } : {}),
  };
}

function normalizeLibraryQuery(
  query: ReplayClipLibraryQuery,
): Required<ReplayClipLibraryQuery> {
  const pageQuery = normalizeMediaLibraryPageQuery(query, {
    pageIndex: 0,
    pageSize: defaultLibraryPageSize,
    sortBy: "createdAt",
    sortDirection: "desc",
  });
  return {
    game: query.game ?? "poe1",
    kind: query.kind ?? "death",
    league: query.league ?? "",
    pageIndex: pageQuery.pageIndex,
    pageSize: pageQuery.pageSize,
    sortBy: pageQuery.sortBy,
    sortDirection: pageQuery.sortDirection,
  };
}

function libraryQueryToListFilter(
  query: Required<ReplayClipLibraryQuery>,
): ReplayClipListFilter {
  return {
    game: query.game,
    kind: query.kind,
    ...(query.league ? { league: query.league } : {}),
  };
}

export type { EditorReplayDetailPageInput };
export { ReplayClipLibraryService };
