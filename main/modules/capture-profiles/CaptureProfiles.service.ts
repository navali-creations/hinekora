import { BrowserWindow } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import { logWarn } from "~/main/utils/app-log";
import {
  assertObject,
  assertString,
  handleValidationError,
  safeErrorMessage,
} from "~/main/utils/ipc-validation";
import {
  getIpcWindowRole,
  registerGuardedIpcHandler,
} from "~/main/utils/ipc-window-roles";

import {
  type CaptureProfile,
  type CaptureProfileCreateInput,
  CaptureProfileCreateInputSchema,
  type CaptureProfileUpdateInput,
  CaptureProfileUpdateInputSchema,
  createDefaultCaptureProfile,
  defaultCaptureProfileIds,
  defaultCaptureProfileNames,
} from "~/types";
import { CaptureProfilesChannel } from "./CaptureProfiles.channels";
import { CaptureProfilesRepository } from "./CaptureProfiles.repository";

const CAPTURE_PROFILES_SCOPE = "capture-profiles";

class CaptureProfilesService {
  private static instance: CaptureProfilesService | null = null;

  private readonly changeListeners = new Set<
    (profiles: CaptureProfile[]) => void
  >();
  private readonly repository: CaptureProfilesRepository;

  static getInstance(): CaptureProfilesService {
    if (!CaptureProfilesService.instance) {
      CaptureProfilesService.instance = new CaptureProfilesService();
    }

    return CaptureProfilesService.instance;
  }

  static resetForTests(): void {
    CaptureProfilesService.instance = null;
  }

  constructor() {
    this.repository = new CaptureProfilesRepository(
      DatabaseService.getInstance(),
    );
    this.setupHandlers();
  }

  list(): CaptureProfile[] {
    return this.repository.list();
  }

  onDidChange(listener: (profiles: CaptureProfile[]) => void): () => void {
    this.changeListeners.add(listener);

    return () => {
      this.changeListeners.delete(listener);
    };
  }

  ensureDefaultProfiles(): CaptureProfile[] {
    const profiles = this.list();

    this.ensureDefaultProfileForGame("poe1", profiles);
    this.ensureDefaultProfileForGame("poe2", profiles);

    return this.list();
  }

  create(input: CaptureProfileCreateInput): CaptureProfile {
    const profile = this.repository.create(
      CaptureProfileCreateInputSchema.parse(input),
    );
    this.publishProfilesChanged();

    return profile;
  }

  update(input: CaptureProfileUpdateInput): CaptureProfile {
    const parsed = CaptureProfileUpdateInputSchema.parse(input);
    const existing = this.repository.get(parsed.id);

    if (
      existing &&
      isProtectedDefaultProfile(existing) &&
      parsed.game &&
      parsed.game !== existing.game
    ) {
      throw new Error("Default capture profiles cannot change game");
    }

    const profile = this.repository.update(parsed);
    this.publishProfilesChanged();

    return profile;
  }

  delete(id: string): void {
    const profile = this.repository.get(id);
    if (profile && isProtectedDefaultProfile(profile)) {
      throw new Error("Default capture profiles cannot be deleted");
    }

    this.repository.delete(id);
    this.ensureDefaultProfiles();
    this.publishProfilesChanged();
  }

  replaceAll(profiles: CaptureProfile[]): void {
    this.repository.replaceAll(
      profiles.map(normalizeCaptureProfileDefaultFlag),
    );
    this.ensureDefaultProfiles();
    this.publishProfilesChanged();
  }

  upsertMany(profiles: CaptureProfile[]): void {
    const database = DatabaseService.getInstance();
    database.transaction(() => {
      for (const profile of profiles) {
        this.repository.upsert(normalizeCaptureProfileDefaultFlag(profile));
      }
    });
    this.ensureDefaultProfiles();
    this.publishProfilesChanged();
  }

  private ensureDefaultProfileForGame(
    game: CaptureProfile["game"],
    profiles: CaptureProfile[],
  ): void {
    const defaultId = defaultCaptureProfileIds[game];
    const existingDefault = profiles.find(
      (profile) =>
        profile.id === defaultId &&
        profile.game === game &&
        profile.isDefault === true,
    );
    if (existingDefault) {
      return;
    }

    const existingDefaultIdProfile = profiles.find(
      (profile) => profile.id === defaultId,
    );
    if (existingDefaultIdProfile?.game === game) {
      this.repository.upsert({
        ...existingDefaultIdProfile,
        name: defaultCaptureProfileNames[game],
        isDefault: true,
      });
      return;
    }

    this.repository.upsert(
      createDefaultCaptureProfile(
        {
          name: defaultCaptureProfileNames[game],
          game,
        },
        {
          id: defaultId,
          isDefault: true,
        },
      ),
    );
  }

  private publishProfilesChanged(): void {
    const profiles = this.list();

    for (const listener of this.changeListeners) {
      try {
        listener(profiles);
      } catch (error) {
        logWarn(CAPTURE_PROFILES_SCOPE, "Capture profile listener failed", {
          error: safeErrorMessage(error),
        });
      }
    }

    for (const window of BrowserWindow.getAllWindows()) {
      if (window.isDestroyed()) {
        continue;
      }

      const isMainWindow =
        getIpcWindowRole({ sender: window.webContents }) === WindowName.Main;
      if (isMainWindow) {
        window.webContents.send(CaptureProfilesChannel.Changed, profiles);
      }
    }
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      CaptureProfilesChannel.List,
      [WindowName.Main],
      () => this.list(),
    );
    registerGuardedIpcHandler(
      CaptureProfilesChannel.Create,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(input, "capture profile", CaptureProfilesChannel.Create);
          return this.create(input as CaptureProfileCreateInput);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      CaptureProfilesChannel.Update,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(input, "capture profile", CaptureProfilesChannel.Update);
          return this.update(input as CaptureProfileUpdateInput);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      CaptureProfilesChannel.Delete,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", CaptureProfilesChannel.Delete, {
            min: 1,
            max: 128,
          });
          this.delete(id);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
  }
}

function isProtectedDefaultProfile(profile: CaptureProfile): boolean {
  return (
    profile.isDefault === true ||
    defaultCaptureProfileIds[profile.game] === profile.id
  );
}

function normalizeCaptureProfileDefaultFlag(
  profile: CaptureProfile,
): CaptureProfile {
  return {
    ...profile,
    isDefault: defaultCaptureProfileIds[profile.game] === profile.id,
  };
}

export { CaptureProfilesService };
