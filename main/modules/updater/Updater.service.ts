import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import { app, autoUpdater, type BrowserWindow, shell } from "electron";

import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logError, logInfo, logWarn } from "~/main/utils/app-log";
import { safeErrorMessage } from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";
import { isWindowsOS } from "~/main/utils/platform";
import { resolveDevFile } from "~/main/utils/resolve-dev-path";

import type {
  ChangelogEntry,
  ChangelogRelease,
  LatestReleaseInfo,
} from "./Updater.api";
import { UpdaterChannel } from "./Updater.channels";

interface GitHubRelease {
  tag_name: string;
  html_url: string;
  name: string;
  body: string;
  published_at: string;
  draft?: boolean;
  prerelease?: boolean;
}

interface UpdateInfo {
  updateAvailable: boolean;
  currentVersion: string;
  latestVersion: string;
  releaseUrl: string;
  releaseName: string;
  releaseNotes: string;
  publishedAt: string;
  downloadUrl: string | null;
  /** When true, "install" opens the releases page instead of restarting (Linux). */
  manualDownload: boolean;
}

interface DownloadProgress {
  percent: number;
  transferredBytes: number;
  totalBytes: number;
}

type UpdateStatus = "idle" | "downloading" | "ready" | "error";

const GITHUB_OWNER = "navali-creations";
const GITHUB_REPO = "hinekora";
const APP_NAME = "Hinekora";
const CHECK_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes
const INITIAL_CHECK_DELAY_MS = 10_000; // 10 seconds after startup
const RECENT_RELEASES_LIMIT = 5;
const GITHUB_FETCH_TIMEOUT_MS = 10_000;
const GITHUB_RELEASES_URL = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;
const GITHUB_RELEASE_PATH_PREFIX = `/${GITHUB_OWNER}/${GITHUB_REPO}/releases/`;
const UPDATER_LOG_SCOPE = "updater";

class UpdaterService {
  private static _instance: UpdaterService;
  private initialCheckTimeout: ReturnType<typeof setTimeout> | null = null;
  private checkInterval: ReturnType<typeof setInterval> | null = null;
  private mainWindow: BrowserWindow | null = null;
  private lastUpdateInfo: UpdateInfo | null = null;
  private updateStatus: UpdateStatus = "idle";
  private updateDownloaded = false;
  private initialized = false;
  private autoUpdaterConfigured = false;

  static getInstance(): UpdaterService {
    if (!UpdaterService._instance) {
      UpdaterService._instance = new UpdaterService();
    }
    return UpdaterService._instance;
  }

  /**
   * Initialize the updater: configure autoUpdater feed (win32/darwin) or
   * GitHub API polling (linux), wire events, register IPC handlers, and
   * start periodic checks.
   *
   * On Windows, Electron's autoUpdater is powered by Squirrel.Windows which
   * handles atomic updates, rollback, shortcut management, and delta updates.
   * On macOS it uses Squirrel.Mac.
   * On Linux, autoUpdater is not supported — we poll the GitHub API for new
   * releases and direct the user to the releases page to download manually.
   */
  public initialize(mainWindow: BrowserWindow): void {
    if (this.initialized) {
      this.mainWindow = mainWindow;
      return;
    }

    this.initialized = true;
    this.mainWindow = mainWindow;

    if (!app.isPackaged) {
      logInfo(UPDATER_LOG_SCOPE, "Skipping auto-update setup", {
        reason: "app is not packaged",
      });
      this.registerIpcHandlers();
      return;
    }

    if (process.platform === "linux") {
      // Linux: use GitHub API polling (no autoUpdater support)
      logInfo(UPDATER_LOG_SCOPE, "Linux detected; using GitHub API checks");
      this.registerIpcHandlers();
      this.startPeriodicChecks();
      return;
    }

    if (!["win32", "darwin"].includes(process.platform)) {
      logInfo(UPDATER_LOG_SCOPE, "Native autoUpdater unsupported", {
        platform: process.platform,
      });
      this.registerIpcHandlers();
      return;
    }

    if (!this.canUseNativeAutoUpdater()) {
      this.registerIpcHandlers();
      return;
    }

    // Configure the Squirrel update feed.
    // update.electronjs.org is the free Electron update service that proxies
    // GitHub Releases in the format Squirrel expects (RELEASES file for
    // Windows, JSON for macOS).
    const feedURL = `https://update.electronjs.org/${GITHUB_OWNER}/${GITHUB_REPO}/${
      process.platform
    }-${process.arch}/${app.getVersion()}`;

    logInfo(UPDATER_LOG_SCOPE, "Setting feed URL", { feedURL });
    autoUpdater.setFeedURL({ url: feedURL });
    this.autoUpdaterConfigured = true;

    this.wireAutoUpdaterEvents();
    this.registerIpcHandlers();
    this.startPeriodicChecks();
  }

  /**
   * Clean up interval on shutdown.
   */
  public destroy(): void {
    if (this.initialCheckTimeout) {
      clearTimeout(this.initialCheckTimeout);
      this.initialCheckTimeout = null;
    }
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    this.mainWindow = null;
  }

  // ─── Periodic checks ──────────────────────────────────────────────────

  private startPeriodicChecks(): void {
    // Initial check after a short delay so we don't block startup
    this.initialCheckTimeout = setTimeout(() => {
      this.initialCheckTimeout = null;
      this.checkForUpdates();
    }, INITIAL_CHECK_DELAY_MS);

    // Periodic checks
    this.checkInterval = setInterval(() => {
      this.checkForUpdates();
    }, CHECK_INTERVAL_MS);
  }

  // ─── autoUpdater event wiring (win32/darwin only) ─────────────────────

  private wireAutoUpdaterEvents(): void {
    autoUpdater.on("checking-for-update", () => {
      logInfo(UPDATER_LOG_SCOPE, "Checking for update");
    });

    autoUpdater.on("update-available", () => {
      logInfo(UPDATER_LOG_SCOPE, "Update available; downloading");
      this.updateStatus = "downloading";

      // We don't get granular download progress from Squirrel, so we send an
      // indeterminate progress (percent = -1) to let the UI show a spinner or
      // indeterminate bar.
      this.sendProgress({ percent: -1, transferredBytes: 0, totalBytes: 0 });
    });

    autoUpdater.on("update-not-available", () => {
      logInfo(UPDATER_LOG_SCOPE, "No update available");
      this.updateStatus = "idle";
    });

    autoUpdater.on(
      "update-downloaded",
      (_event, releaseNotes, releaseName, _releaseDate, updateURL) => {
        logInfo(UPDATER_LOG_SCOPE, "Update downloaded", {
          releaseName: releaseName || null,
        });

        this.updateDownloaded = true;
        this.updateStatus = "ready";

        // Build an UpdateInfo from whatever autoUpdater gives us
        const latestVersion = this.parseVersionFromName(releaseName);

        const info: UpdateInfo = {
          updateAvailable: true,
          currentVersion: app.getVersion(),
          latestVersion,
          releaseUrl: this.resolveTrustedReleaseUrl(updateURL),
          releaseName: releaseName || `v${latestVersion}`,
          releaseNotes: releaseNotes || "",
          publishedAt: new Date().toISOString(),
          downloadUrl: null, // already downloaded
          manualDownload: false,
        };

        this.lastUpdateInfo = info;

        // Notify the renderer so the download-icon indicator appears
        this.mainWindow?.webContents.send(
          UpdaterChannel.OnUpdateAvailable,
          info,
        );

        // Also send progress = 100% so any progress UI completes
        this.sendProgress({ percent: 100, transferredBytes: 0, totalBytes: 0 });
      },
    );

    autoUpdater.on("error", (err) => {
      logError(UPDATER_LOG_SCOPE, "Native updater error", {
        error: safeErrorMessage(err),
      });
      this.updateStatus = "error";

      // Don't crash the app — just log it. The user can retry via the UI.
    });
  }

  // ─── IPC handlers ─────────────────────────────────────────────────────

  private registerIpcHandlers(): void {
    registerGuardedIpcHandler(
      UpdaterChannel.CheckForUpdates,
      [WindowName.Main],
      async () => {
        return this.checkForUpdates();
      },
    );

    registerGuardedIpcHandler(
      UpdaterChannel.GetUpdateInfo,
      [WindowName.Main],
      async () => {
        return this.lastUpdateInfo;
      },
    );

    // DownloadUpdate is a no-op with Squirrel — download happens automatically
    // after checkForUpdates finds an update.  On Linux this is also a no-op
    // since we don't download anything.  We keep the handler so the renderer
    // API doesn't break.
    registerGuardedIpcHandler(
      UpdaterChannel.DownloadUpdate,
      [WindowName.Main],
      async () => {
        if (process.platform === "linux" || this.updateDownloaded) {
          return { success: true };
        }
        // If an update is being downloaded, just acknowledge
        if (this.updateStatus === "downloading") {
          return { success: true };
        }
        // Otherwise trigger a check which will auto-download if available
        this.checkForUpdates();
        return { success: true };
      },
    );

    registerGuardedIpcHandler(
      UpdaterChannel.InstallUpdate,
      [WindowName.Main],
      async () => {
        return this.installUpdate();
      },
    );

    // Fetch recent GitHub releases (for the "What's New" modal tabs)
    registerGuardedIpcHandler(
      UpdaterChannel.GetRecentReleases,
      [WindowName.Main],
      async () => {
        try {
          const releases = await this.fetchRecentReleases();
          return releases.map((release) => this.toLatestReleaseInfo(release));
        } catch (error) {
          logError(UPDATER_LOG_SCOPE, "Failed to fetch recent releases", {
            error: safeErrorMessage(error),
          });
          return [];
        }
      },
    );

    // Read and parse CHANGELOG.md from disk (for Changelog page)
    registerGuardedIpcHandler(
      UpdaterChannel.GetChangelog,
      [WindowName.Main],
      async () => {
        try {
          const changelogPath = app.isPackaged
            ? join(process.resourcesPath, "CHANGELOG.md")
            : resolveDevFile(app.getAppPath(), "CHANGELOG.md");

          const content = readFileSync(changelogPath, "utf-8");
          const releases = this.parseChangelog(content);
          return { success: true, releases };
        } catch (error) {
          logError(UPDATER_LOG_SCOPE, "Failed to read CHANGELOG.md", {
            error: safeErrorMessage(error),
          });
          return {
            success: false,
            releases: [],
            error: (error as Error).message,
          };
        }
      },
    );
  }

  // ─── Public methods ───────────────────────────────────────────────────

  /**
   * Trigger an update check.
   *
   * - win32/darwin: calls autoUpdater.checkForUpdates() which auto-downloads
   *   if an update is found.
   * - linux: fetches the GitHub API to compare versions and notifies the
   *   renderer if a newer release exists.
   */
  public checkForUpdates(): UpdateInfo | null {
    if (!app.isPackaged) {
      logInfo(UPDATER_LOG_SCOPE, "Skipping update check", {
        reason: "app is not packaged",
      });
      return null;
    }

    if (process.platform === "linux") {
      this.checkForUpdatesViaGitHub();
      return this.lastUpdateInfo;
    }

    if (!["win32", "darwin"].includes(process.platform)) {
      return null;
    }

    if (!this.autoUpdaterConfigured) {
      logInfo(UPDATER_LOG_SCOPE, "Skipping update check", {
        reason: "native autoUpdater is not configured",
      });
      return null;
    }

    try {
      autoUpdater.checkForUpdates();
    } catch (err) {
      logError(UPDATER_LOG_SCOPE, "checkForUpdates failed", {
        error: safeErrorMessage(err),
      });
    }

    return this.lastUpdateInfo;
  }

  /**
   * Apply the downloaded update.
   *
   * - win32/darwin: calls autoUpdater.quitAndInstall() which quits the app,
   *   lets Squirrel swap files atomically, and relaunches.
   * - linux: opens the GitHub Releases page in the default browser so the
   *   user can download the new .deb/.rpm manually.
   */
  public installUpdate(): { success: boolean; error?: string } {
    if (process.platform === "linux") {
      return this.openReleasePage();
    }

    if (!this.updateDownloaded) {
      return { success: false, error: "No update has been downloaded yet" };
    }

    try {
      logInfo(UPDATER_LOG_SCOPE, "Quitting and installing update");
      // autoUpdater.quitAndInstall() will:
      // 1. Quit the running app
      // 2. Squirrel applies the update (atomic file swap)
      // 3. Relaunch the new version
      autoUpdater.quitAndInstall();
      return { success: true };
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Unknown install error";
      logError(UPDATER_LOG_SCOPE, "Install failed", { error: message });
      return { success: false, error: message };
    }
  }

  // ─── Linux: GitHub API version check ──────────────────────────────────

  /**
   * Fetch the latest release from the GitHub API and compare versions.
   * If a newer version exists, notify the renderer so the download icon
   * appears.  This does NOT download anything — the user will be directed
   * to the releases page when they click "install".
   */
  private async checkForUpdatesViaGitHub(): Promise<void> {
    try {
      const release = await this.fetchLatestRelease();
      if (!release) return;

      const currentVersion = app.getVersion();
      const latestVersion = release.tag_name.replace(/^v/, "");
      const updateAvailable = this.isNewerVersion(
        currentVersion,
        latestVersion,
      );

      if (!updateAvailable) {
        logInfo(UPDATER_LOG_SCOPE, "App is up to date", {
          currentVersion,
        });
        return;
      }

      logInfo(UPDATER_LOG_SCOPE, "Update available", {
        currentVersion,
        latestVersion,
      });

      const info: UpdateInfo = {
        updateAvailable: true,
        currentVersion,
        latestVersion,
        releaseUrl: this.resolveTrustedReleaseUrl(release.html_url),
        releaseName: release.name || `v${latestVersion}`,
        releaseNotes: release.body || "",
        publishedAt: release.published_at,
        downloadUrl: this.resolveTrustedReleaseUrl(release.html_url),
        manualDownload: true,
      };

      this.lastUpdateInfo = info;
      // On Linux we mark as "ready" immediately since there's no download
      // step — the user just needs to click to open the releases page.
      this.updateStatus = "ready";

      this.mainWindow?.webContents.send(UpdaterChannel.OnUpdateAvailable, info);
    } catch (error) {
      logError(UPDATER_LOG_SCOPE, "GitHub API check failed", {
        error: safeErrorMessage(error),
      });
    }
  }

  /**
   * Fetch the latest non-draft, non-prerelease from the GitHub API.
   */
  private async fetchLatestRelease(): Promise<GitHubRelease | null> {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases/latest`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": `${APP_NAME}/${app.getVersion()}`,
      },
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      logWarn(UPDATER_LOG_SCOPE, "GitHub API responded with an error", {
        status: response.status,
        statusText: response.statusText,
      });
      return null;
    }

    return (await response.json()) as GitHubRelease;
  }

  /**
   * Fetch a bounded list of recent non-draft, non-prerelease GitHub releases.
   */
  private async fetchRecentReleases(): Promise<GitHubRelease[]> {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/releases?per_page=${RECENT_RELEASES_LIMIT}`;

    const response = await fetch(url, {
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": `${APP_NAME}/${app.getVersion()}`,
      },
      signal: AbortSignal.timeout(GITHUB_FETCH_TIMEOUT_MS),
    });

    if (!response.ok) {
      logWarn(UPDATER_LOG_SCOPE, "GitHub API responded with an error", {
        status: response.status,
        statusText: response.statusText,
      });
      return [];
    }

    const releases = (await response.json()) as GitHubRelease[];
    return releases.filter((release) => !release.draft && !release.prerelease);
  }

  /**
   * Open the GitHub Releases page in the user's default browser.
   */
  private openReleasePage(): { success: boolean; error?: string } {
    const url = this.resolveTrustedReleaseUrl(this.lastUpdateInfo?.releaseUrl);

    logInfo(UPDATER_LOG_SCOPE, "Opening release page", { url });
    void shell.openExternal(url);
    return { success: true };
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private canUseNativeAutoUpdater(): boolean {
    if (!isWindowsOS()) {
      return true;
    }

    const appDir = dirname(process.execPath);
    const squirrelUpdatePaths = [
      join(appDir, "Update.exe"),
      resolve(appDir, "..", "Update.exe"),
    ];

    const hasSquirrelUpdateExe = squirrelUpdatePaths.some((candidate) =>
      existsSync(candidate),
    );

    if (!hasSquirrelUpdateExe) {
      logInfo(UPDATER_LOG_SCOPE, "Skipping Windows auto-update setup", {
        reason: "Squirrel Update.exe not found",
      });
    }

    return hasSquirrelUpdateExe;
  }

  /**
   * Send download progress to the renderer.
   */
  private sendProgress(progress: DownloadProgress): void {
    this.mainWindow?.webContents.send(
      UpdaterChannel.OnDownloadProgress,
      progress,
    );
  }

  /**
   * Try to extract a semver version string from a release name.
   * Handles formats like "v1.2.3", "Hinekora v1.2.3", "1.2.3", etc.
   */
  private parseVersionFromName(releaseName: string | null): string {
    if (!releaseName) return "0.0.0";

    const match = releaseName.match(/(\d+\.\d+\.\d+)/);
    return match?.[1] ?? releaseName;
  }

  private toLatestReleaseInfo(release: GitHubRelease): LatestReleaseInfo {
    const body = release.body || "";
    const parsed = this.parseReleaseBody(body);

    return {
      version: release.tag_name.replace(/^v/, ""),
      name: release.name || release.tag_name,
      body,
      publishedAt: release.published_at,
      url: this.resolveTrustedReleaseUrl(release.html_url),
      changeType: parsed.changeType,
      entries: parsed.entries,
    };
  }

  private isTrustedReleaseUrl(value: string | null | undefined): boolean {
    if (!value) {
      return false;
    }

    try {
      const url = new URL(value);

      return (
        url.protocol === "https:" &&
        url.hostname.toLowerCase() === "github.com" &&
        url.pathname.startsWith(GITHUB_RELEASE_PATH_PREFIX)
      );
    } catch {
      return false;
    }
  }

  private resolveTrustedReleaseUrl(value: string | null | undefined): string {
    if (typeof value === "string" && this.isTrustedReleaseUrl(value)) {
      return value;
    }

    return GITHUB_RELEASES_URL;
  }

  // ─── Release body parsing ─────────────────────────────────────────────

  /**
   * Parse a single GitHub release body into structured entries.
   * Wraps it as a fake versioned release and delegates to parseChangelog.
   */
  private parseReleaseBody(body: string): {
    changeType: string;
    entries: ChangelogEntry[];
  } {
    // Wrap body in a synthetic version header so parseChangelog can handle it
    const wrapped = `## 0.0.0\n\n${body}`;
    const releases = this.parseChangelog(wrapped);

    const release = releases[0];
    if (release) {
      return {
        changeType: release.changeType,
        entries: release.entries,
      };
    }

    return { changeType: "Changes", entries: [] };
  }

  // ─── Changelog parsing ────────────────────────────────────────────────

  /**
   * Parse a CHANGELOG.md string into structured release objects.
   * Handles Windows \r\n line endings.
   */
  private parseChangelog(markdown: string): ChangelogRelease[] {
    const releases: ChangelogRelease[] = [];
    // Normalize line endings to handle Windows \r\n
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");

    let currentRelease: ChangelogRelease | null = null;
    let currentEntry: ChangelogEntry | null = null;
    // Tracks whether we've passed the description line and entered rich content
    // (i.e. after the first blank line following the entry's description).
    let contentStarted = false;

    const flushEntry = () => {
      if (currentEntry && currentRelease) {
        // Trim trailing whitespace from accumulated content
        if (currentEntry.content) {
          currentEntry.content = currentEntry.content.trim();
          if (!currentEntry.content) {
            delete currentEntry.content;
          }
        }
        currentRelease.entries.push(currentEntry);
        currentEntry = null;
      }
      contentStarted = false;
    };

    for (const line of lines) {
      // Version header: ## X.Y.Z
      const versionMatch = line.match(/^## (\d+\.\d+\.\d+.*)$/);
      const version = versionMatch?.[1];
      if (version) {
        flushEntry();
        currentRelease = {
          version: version.trim(),
          changeType: "Changes",
          entries: [],
        };
        releases.push(currentRelease);
        continue;
      }

      // Change type header: ### Patch Changes / ### Minor Changes / etc.
      // Only matches exactly 3 hashes (#### sub-headers are handled as content below)
      const changeTypeMatch = line.match(/^### (.+)$/);
      const changeType = changeTypeMatch?.[1];
      if (changeType && !line.startsWith("####") && currentRelease) {
        flushEntry();
        const incoming = changeType.trim();
        // Only upgrade changeType - never downgrade (Major > Minor > Patch).
        // This ensures a release with both Minor and Patch sections is
        // reported as "Minor Changes".
        if (
          this.changeTypePriority(incoming) >
          this.changeTypePriority(currentRelease.changeType)
        ) {
          currentRelease.changeType = incoming;
        }
        continue;
      }

      // Top-level list item (starts with "- ")
      if (line.match(/^- /) && currentRelease) {
        flushEntry();
        currentEntry = this.parseChangelogEntry(line);
        continue;
      }

      // Sub-item (indented list item, e.g. "  - something")
      if (line.match(/^\s{2,}-\s/) && currentEntry) {
        const subText = line.replace(/^\s+-\s*/, "").trim();
        if (subText) {
          if (!currentEntry.subItems) {
            currentEntry.subItems = [];
          }
          currentEntry.subItems.push(subText);
        }
        continue;
      }

      // ---- Rich content & continuation handling ----
      if (!currentEntry) continue;

      const trimmed = line.trim();

      // #### sub-section headers always start/append to content
      if (line.startsWith("####")) {
        contentStarted = true;
        if (!currentEntry.content) currentEntry.content = "";
        currentEntry.content += `${line}\n`;
        continue;
      }

      // Blank line
      if (!trimmed) {
        if (contentStarted) {
          // Preserve blank lines inside content
          if (!currentEntry.content) currentEntry.content = "";
          currentEntry.content += "\n";
        } else {
          // First blank line after entry description - content starts
          contentStarted = true;
        }
        continue;
      }

      // Non-blank, non-#### line
      if (contentStarted) {
        // We're in content mode — accumulate preserving markdown
        if (!currentEntry.content) currentEntry.content = "";
        currentEntry.content += `${line}\n`;
      } else if (!line.startsWith("#")) {
        // Simple description continuation (before any blank line)
        currentEntry.description += ` ${trimmed}`;
      }
    }

    // Flush last entry
    flushEntry();

    return releases;
  }

  /**
   * Parse a single changelog list-item line into a ChangelogEntry.
   */
  private parseChangelogEntry(line: string): ChangelogEntry {
    const trimmed = line.replace(/^-\s*/, "").trim();

    // Pattern: [`commitHash`](url) Thanks [@user](url)! - Description
    // The inline description after "! -" is optional (changesets often put it on the next line)
    const richPattern =
      /^\[`([a-f0-9]+)`\]\((https?:\/\/[^\s)]+)\)\s*Thanks\s*\[@([^\]]+)\]\((https?:\/\/[^\s)]+)\)!\s*(?:-\s*(.+))?$/;
    const richMatch = trimmed.match(richPattern);

    if (richMatch) {
      const commitHash = richMatch[1] as string;
      const commitUrl = richMatch[2] as string;
      const contributor = richMatch[3] as string;
      const contributorUrl = richMatch[4] as string;
      const description = richMatch[5];

      return {
        description: description?.trim() ?? "",
        commitHash,
        commitUrl,
        contributor,
        contributorUrl,
      };
    }

    // Pattern: commitHash: Description (simple)
    const simplePattern = /^([a-f0-9]{7,40}):\s*(.+)$/;
    const simpleMatch = trimmed.match(simplePattern);

    if (simpleMatch) {
      const commitHash = simpleMatch[1] as string;
      const description = simpleMatch[2] as string;

      return {
        description: description.trim(),
        commitHash,
      };
    }

    // Plain text entry
    return { description: trimmed };
  }

  /**
   * Compare two semver strings. Returns true if `latest` is newer than
   * `current`.
   */
  /**
   * Return a numeric priority for a change-type header so we can compare them.
   * Higher number = more significant change type.
   */
  private changeTypePriority(changeType: string): number {
    const lower = changeType.toLowerCase();
    if (lower.includes("major")) return 3;
    if (lower.includes("minor")) return 2;
    if (lower.includes("patch")) return 1;
    return 0;
  }

  private isNewerVersion(current: string, latest: string): boolean {
    const parseSemver = (v: string) =>
      v.split(".").map((n) => Number.parseInt(n, 10));

    const [curMajor = 0, curMinor = 0, curPatch = 0] = parseSemver(current);
    const [latMajor = 0, latMinor = 0, latPatch = 0] = parseSemver(latest);

    if (latMajor !== curMajor) return latMajor > curMajor;
    if (latMinor !== curMinor) return latMinor > curMinor;
    return latPatch > curPatch;
  }
}

export type { DownloadProgress, UpdateInfo, UpdateStatus };
export { UpdaterService };
