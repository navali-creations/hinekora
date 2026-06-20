import { desktopCapturer, screen } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  detectPoeProcessState,
  isPoeProcessStateForGame,
} from "~/main/pollers";
import { logWarn } from "~/main/utils/app-log";
import {
  createDisplayDimensionsLookup,
  type DisplayDimensions,
} from "~/main/utils/display-geometry";
import {
  assertOptionalBoolean,
  assertString,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import {
  type CapturePreviewSource,
  CapturePreviewSourceSchema,
  type GameId,
} from "~/types";
import { CapturePreviewChannel } from "./CapturePreview.channels";
import {
  detectPathOfExileWindowTitle,
  normalizeCapturePreviewSources,
} from "./CapturePreview.sources";

const SOURCE_ID_CACHE_MS = 1_500;
const GAME_RUNNING_CACHE_MS = 1_500;
const SLOW_SOURCE_LIST_MS = 250;

interface CapturePreviewListSourcesOptions {
  forceRefresh?: boolean;
}

class CapturePreviewService {
  private static instance: CapturePreviewService | null = null;
  private sourceListCache: CapturePreviewSource[] | null = null;
  private sourceListRequest: Promise<CapturePreviewSource[]> | null = null;
  private sourceIdCache: { checkedAtMs: number; ids: Set<string> } | null =
    null;
  private sourceIdRequest: Promise<Set<string>> | null = null;
  private gameRunningCache: {
    checkedAtMs: number;
    runningGames: Set<GameId>;
  } | null = null;
  private gameRunningRequest: Promise<Set<GameId>> | null = null;

  static getInstance(): CapturePreviewService {
    if (!CapturePreviewService.instance) {
      CapturePreviewService.instance = new CapturePreviewService();
    }

    return CapturePreviewService.instance;
  }

  constructor() {
    this.setupHandlers();
  }

  async listSources(
    options: CapturePreviewListSourcesOptions = {},
  ): Promise<CapturePreviewSource[]> {
    if (!options.forceRefresh && this.sourceListCache) {
      return this.sourceListCache;
    }

    if (!options.forceRefresh && this.sourceListRequest) {
      return this.sourceListRequest;
    }

    if (!options.forceRefresh) {
      this.sourceListRequest = this.collectSources(false).finally(() => {
        this.sourceListRequest = null;
      });

      return this.sourceListRequest;
    }

    return this.collectSources(true);
  }

  private async collectSources(
    forceRefresh: boolean,
  ): Promise<CapturePreviewSource[]> {
    const startedAtMs = Date.now();
    const displayDimensions = this.createDisplayDimensionsLookup();
    const [sources, poeProcessState] = await Promise.all([
      desktopCapturer.getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 360, height: 204 },
      }),
      detectPoeProcessState(),
    ]);

    const sourceInputs = sources.slice(0, 64).map((source) => {
      const displayId = source.display_id || null;
      const dimensions = displayId
        ? (displayDimensions.get(displayId) ?? null)
        : null;

      return {
        id: source.id,
        name: source.name,
        displayId,
        width: dimensions?.width ?? null,
        height: dimensions?.height ?? null,
        thumbnailDataUrl: source.thumbnail.isEmpty()
          ? null
          : source.thumbnail.toDataURL(),
      };
    });
    const filteredSourceInputs = sourceInputs.filter((source) => {
      if (source.id.startsWith("screen:")) {
        return true;
      }

      const game = detectPathOfExileWindowTitle(source.name);

      return game !== null && isPoeProcessStateForGame(poeProcessState, game);
    });

    const normalizedSources = normalizeCapturePreviewSources(
      filteredSourceInputs,
    ).map((source) => CapturePreviewSourceSchema.parse(source));

    this.sourceListCache = normalizedSources;
    const elapsedMs = Math.max(0, Date.now() - startedAtMs);
    if (elapsedMs >= SLOW_SOURCE_LIST_MS) {
      logWarn("capture-preview", "Capture source listing was slow", {
        elapsedMs,
        forceRefresh,
        inputSources: sources.length,
        returnedSources: normalizedSources.length,
      });
    }

    return normalizedSources;
  }

  async sourceExists(sourceId: string): Promise<boolean> {
    const ids = await this.listSourceIds();

    return ids.has(sourceId);
  }

  async isGameRunning(
    game: GameId,
    options: CapturePreviewListSourcesOptions = {},
  ): Promise<boolean> {
    const runningGames = await this.listRunningGames(options);

    return runningGames.has(game);
  }

  private async listRunningGames(
    options: CapturePreviewListSourcesOptions = {},
  ): Promise<Set<GameId>> {
    const now = Date.now();
    if (
      !options.forceRefresh &&
      this.gameRunningCache &&
      now - this.gameRunningCache.checkedAtMs < GAME_RUNNING_CACHE_MS
    ) {
      return this.gameRunningCache.runningGames;
    }

    if (!options.forceRefresh && this.gameRunningRequest) {
      return this.gameRunningRequest;
    }

    this.gameRunningRequest = detectPoeProcessState()
      .then(async (poeProcessState) => {
        const runningGames = new Set<GameId>();
        if (!poeProcessState.isRunning) {
          this.gameRunningCache = { checkedAtMs: Date.now(), runningGames };

          return runningGames;
        }

        const sources = await desktopCapturer.getSources({
          types: ["window"],
          thumbnailSize: { width: 0, height: 0 },
        });

        for (const source of sources) {
          const game = detectPathOfExileWindowTitle(source.name);
          if (game && isPoeProcessStateForGame(poeProcessState, game)) {
            runningGames.add(game);
          }
        }
        this.gameRunningCache = { checkedAtMs: Date.now(), runningGames };

        return runningGames;
      })
      .finally(() => {
        this.gameRunningRequest = null;
      });

    return this.gameRunningRequest;
  }

  private async listSourceIds(): Promise<Set<string>> {
    const now = Date.now();
    if (
      this.sourceIdCache &&
      now - this.sourceIdCache.checkedAtMs < SOURCE_ID_CACHE_MS
    ) {
      return this.sourceIdCache.ids;
    }

    if (this.sourceIdRequest) {
      return this.sourceIdRequest;
    }

    this.sourceIdRequest = desktopCapturer
      .getSources({
        types: ["screen", "window"],
        thumbnailSize: { width: 0, height: 0 },
      })
      .then((sources) => {
        const ids = new Set(sources.map((source) => source.id));
        this.sourceIdCache = { checkedAtMs: Date.now(), ids };

        return ids;
      })
      .finally(() => {
        this.sourceIdRequest = null;
      });

    return this.sourceIdRequest;
  }

  private createDisplayDimensionsLookup(): Map<string, DisplayDimensions> {
    return createDisplayDimensionsLookup(screen.getAllDisplays());
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      CapturePreviewChannel.ListSources,
      [WindowName.Main, WindowName.AuraOverlay],
      (_event, forceRefresh) => {
        try {
          assertOptionalBoolean(
            forceRefresh,
            "forceRefresh",
            CapturePreviewChannel.ListSources,
          );

          return this.listSources(
            forceRefresh === true ? { forceRefresh: true } : {},
          );
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      CapturePreviewChannel.SourceExists,
      [WindowName.Main, WindowName.AuraOverlay],
      (_event, sourceId) => {
        try {
          assertString(
            sourceId,
            "sourceId",
            CapturePreviewChannel.SourceExists,
            {
              min: 1,
              max: 512,
            },
          );

          return this.sourceExists(sourceId);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }
}

export { CapturePreviewService };
