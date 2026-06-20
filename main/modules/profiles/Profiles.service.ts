import { BrowserWindow } from "electron";

import { DatabaseService } from "~/main/modules/database";
import { WindowName } from "~/main/modules/main-window/MainWindow.types";
import {
  assertObject,
  assertString,
  handleValidationError,
} from "~/main/utils/ipc-validation";
import { registerGuardedIpcHandler } from "~/main/utils/ipc-window-roles";

import {
  type Profile,
  type ProfileCreateInput,
  ProfileCreateInputSchema,
  type ProfileUpdateInput,
  ProfileUpdateInputSchema,
} from "~/types";
import { ProfilesChannel } from "./Profiles.channels";
import { ProfilesRepository } from "./Profiles.repository";

class ProfilesService {
  private static instance: ProfilesService | null = null;

  private readonly repository: ProfilesRepository;

  static getInstance(): ProfilesService {
    if (!ProfilesService.instance) {
      ProfilesService.instance = new ProfilesService();
    }

    return ProfilesService.instance;
  }

  constructor() {
    this.repository = new ProfilesRepository(DatabaseService.getInstance());
    this.setupHandlers();
  }

  list(): Profile[] {
    return this.repository.list();
  }

  ensureDefaultProfile(): Profile {
    const [existing] = this.list();
    if (existing) {
      return existing;
    }

    return this.create({
      name: "Default PoE Profile",
      game: "poe1",
    });
  }

  create(input: ProfileCreateInput): Profile {
    const profile = this.repository.create(
      ProfileCreateInputSchema.parse(input),
    );
    this.publishProfilesChanged();

    return profile;
  }

  update(input: ProfileUpdateInput): Profile {
    const profile = this.repository.update(
      ProfileUpdateInputSchema.parse(input),
    );
    this.publishProfilesChanged();

    return profile;
  }

  delete(id: string): void {
    this.repository.delete(id);
    this.publishProfilesChanged();
  }

  replaceAll(profiles: Profile[]): void {
    this.repository.replaceAll(profiles);
    this.publishProfilesChanged();
  }

  upsertMany(profiles: Profile[]): void {
    const database = DatabaseService.getInstance();
    database.transaction(() => {
      for (const profile of profiles) {
        this.repository.upsert(profile);
      }
    });
    this.publishProfilesChanged();
  }

  private publishProfilesChanged(): void {
    const profiles = this.list();

    for (const window of BrowserWindow.getAllWindows()) {
      if (!window.isDestroyed()) {
        window.webContents.send(ProfilesChannel.Changed, profiles);
      }
    }
  }

  private setupHandlers(): void {
    registerGuardedIpcHandler(
      ProfilesChannel.List,
      [WindowName.Main, WindowName.AuraOverlay],
      () => this.list(),
    );
    registerGuardedIpcHandler(
      ProfilesChannel.Create,
      [WindowName.Main],
      (_event, input: unknown) => {
        try {
          assertObject(input, "profile", ProfilesChannel.Create);
          return this.create(input as ProfileCreateInput);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ProfilesChannel.Update,
      [WindowName.Main, WindowName.AuraOverlay],
      (_event, input: unknown) => {
        try {
          assertObject(input, "profile", ProfilesChannel.Update);
          return this.update(input as ProfileUpdateInput);
        } catch (error) {
          return handleValidationError(error);
        }
      },
    );
    registerGuardedIpcHandler(
      ProfilesChannel.Delete,
      [WindowName.Main],
      (_event, id: unknown) => {
        try {
          assertString(id, "id", ProfilesChannel.Delete, {
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

export { ProfilesService };
