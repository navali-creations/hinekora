import { shell } from "electron";

import { DatabaseService } from "~/main/modules/database";
import type { EditorMediaAsset } from "~/main/modules/editor/Editor.dto";
import { resolveEditorProjectTimelineAssets } from "~/main/modules/editor/EditorProject.metadata";
import { EditorProjectRepository } from "~/main/modules/editor/EditorProject.repository";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { normalizeMediaLibraryPageQuery } from "~/main/modules/media-library/MediaLibrary.utils";
import { RecordingStorageService } from "~/main/modules/recording-storage";
import { ReplayClipsService } from "~/main/modules/replay-clips";
import { createTextHash, logInfo } from "~/main/utils/app-log";
import {
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import { SavedEditsChannel } from "./SavedEdits.channels";
import type {
  SavedEditFileActionResult,
  SavedEditsLibraryPage,
  SavedEditsLibraryQuery,
} from "./SavedEdits.dto";
import {
  validateSavedEditProjectId,
  validateSavedEditsLibraryQuery,
} from "./SavedEdits.validation";

const defaultSavedEditsLibraryPageSize = 20;
const savedEditsLogScope = "saved-edits";

class SavedEditsService {
  private static instance: SavedEditsService | null = null;
  private readonly projectRepository: EditorProjectRepository;

  static getInstance(): SavedEditsService {
    if (!SavedEditsService.instance) {
      SavedEditsService.instance = new SavedEditsService();
    }

    return SavedEditsService.instance;
  }

  static resetForTests(): void {
    SavedEditsService.instance = null;
  }

  constructor(projectRepository?: EditorProjectRepository) {
    this.projectRepository =
      projectRepository ??
      new EditorProjectRepository(DatabaseService.getInstance());
    this.setupHandlers();
  }

  listLibrary(query: SavedEditsLibraryQuery = {}): SavedEditsLibraryPage {
    const normalizedQuery = normalizeMediaLibraryPageQuery(query, {
      pageIndex: 0,
      pageSize: defaultSavedEditsLibraryPageSize,
      sortBy: "updatedAt",
      sortDirection: "desc",
    });
    let result = this.projectRepository.listSavedEditPage({
      ...(query.game ? { game: query.game } : {}),
      ...(query.league ? { league: query.league } : {}),
      pageIndex: normalizedQuery.pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
    });
    const pageCount = Math.max(
      1,
      Math.ceil(result.totalCount / normalizedQuery.pageSize),
    );
    const pageIndex = Math.min(normalizedQuery.pageIndex, pageCount - 1);
    if (pageIndex !== normalizedQuery.pageIndex) {
      result = this.projectRepository.listSavedEditPage({
        ...(query.game ? { game: query.game } : {}),
        ...(query.league ? { league: query.league } : {}),
        pageIndex,
        pageSize: normalizedQuery.pageSize,
        sortBy: normalizedQuery.sortBy,
        sortDirection: normalizedQuery.sortDirection,
      });
    }

    return {
      availableLeagues: result.availableLeagues,
      globalTotalCount: result.globalTotalCount,
      items: result.projects,
      pageCount,
      pageIndex,
      pageSize: normalizedQuery.pageSize,
      sortBy: normalizedQuery.sortBy,
      sortDirection: normalizedQuery.sortDirection,
      totalCount: result.totalCount,
    };
  }

  delete(projectId: string): void {
    this.projectRepository.delete(projectId);
    logInfo(savedEditsLogScope, "Saved edit deleted", {
      projectIdHash: createTextHash(projectId),
    });
  }

  deleteAll(): void {
    this.projectRepository.deleteAll();
    logInfo(savedEditsLogScope, "All saved edits deleted");
  }

  revealInExplorer(projectId: string): SavedEditFileActionResult {
    try {
      const project = this.projectRepository.get(projectId);
      if (!project) {
        return { status: "unavailable", error: "Saved edit is not available" };
      }

      const timelineAssets = resolveEditorProjectTimelineAssets(project);
      const asset =
        timelineAssets.find((item) => item.exists && item.mediaUrl !== null) ??
        timelineAssets[0] ??
        null;
      if (!asset) {
        return {
          status: "unavailable",
          error: "Saved edit has no source media",
        };
      }

      return this.revealSourceInExplorer(asset);
    } catch (error) {
      return { status: "unavailable", error: safeErrorMessage(error) };
    }
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      SavedEditsChannel.ListLibrary,
      [WindowName.Main],
      (_event, query: unknown) => {
        try {
          return this.listLibrary(validateSavedEditsLibraryQuery(query));
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      SavedEditsChannel.Delete,
      [WindowName.Main],
      (_event, projectId: unknown) => {
        try {
          this.delete(
            validateSavedEditProjectId(projectId, SavedEditsChannel.Delete),
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      SavedEditsChannel.DeleteAll,
      [WindowName.Main],
      () => this.deleteAll(),
    );
    registerGuardedIpcHandler(
      SavedEditsChannel.RevealInExplorer,
      [WindowName.Main],
      (_event, projectId: unknown) => {
        try {
          return this.revealInExplorer(
            validateSavedEditProjectId(
              projectId,
              SavedEditsChannel.RevealInExplorer,
            ),
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }

  private revealSourceInExplorer(
    asset: EditorMediaAsset,
  ): SavedEditFileActionResult {
    if (asset.kind === "recording") {
      const sourcePath =
        RecordingStorageService.getInstance().getRecordingMediaPath(asset.id);
      if (!sourcePath) {
        return {
          status: "unavailable",
          error: "Saved edit source media is not available",
        };
      }

      shell.showItemInFolder(sourcePath);

      return { status: "success", error: null };
    }

    const result = ReplayClipsService.getInstance().revealClip(asset.id);
    if (!result.ok) {
      return {
        status: "unavailable",
        error: result.error ?? "Saved edit source media is not available",
      };
    }

    return { status: "success", error: null };
  }
}

export { SavedEditsService };
