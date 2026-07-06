import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

import { FuseV1Options, FuseVersion } from "@electron/fuses";
import { MakerDeb } from "@electron-forge/maker-deb";
import { MakerRpm } from "@electron-forge/maker-rpm";
import { MakerSquirrel } from "@electron-forge/maker-squirrel";
import { MakerZIP } from "@electron-forge/maker-zip";
import { AutoUnpackNativesPlugin } from "@electron-forge/plugin-auto-unpack-natives";
import { FusesPlugin } from "@electron-forge/plugin-fuses";
import { VitePlugin } from "@electron-forge/plugin-vite";
import type { ForgeConfig } from "@electron-forge/shared-types";

const logoDir = path.resolve(__dirname, "renderer/assets/logo");
const windowsIcon = path.join(logoDir, "windows/icon.ico");
const macosIcon = path.join(logoDir, "macos/icon.icns");
const linuxIconDir = path.join(logoDir, "linux/icons");
const linuxIcon = path.join(linuxIconDir, "512x512.png");
const windowsIconUrl =
  "https://raw.githubusercontent.com/navali-creations/hinekora/main/renderer/assets/logo/windows/icon.ico";
const poeProcessHelperResource = "./helpers/bin/poe-process-helper";

if (process.platform === "win32") {
  process.env.GYP_MSVS_VERSION ??= "2022";
  delete process.env.VCINSTALLDIR;
  delete process.env.VSINSTALLDIR;
  delete process.env.VisualStudioVersion;
}

const makers: NonNullable<ForgeConfig["makers"]> = [];
const packagedNodeModules = [
  "/node_modules/noobs",
  "/node_modules/node-addon-api",
];

function resolvePackagerIcon(): string {
  if (process.platform === "darwin") {
    return macosIcon;
  }

  if (process.platform === "linux") {
    return linuxIcon;
  }

  return windowsIcon;
}

function ensurePackageLocalModule(moduleName: string): void {
  const moduleParts = moduleName.split("/");
  const localModulePath = path.resolve(
    __dirname,
    "node_modules",
    ...moduleParts,
  );
  if (fs.existsSync(localModulePath)) {
    return;
  }

  const hoistedModulePath = path.resolve(
    __dirname,
    "../../node_modules",
    ...moduleParts,
  );
  if (!fs.existsSync(hoistedModulePath)) {
    return;
  }

  fs.mkdirSync(path.dirname(localModulePath), { recursive: true });
  fs.symlinkSync(hoistedModulePath, localModulePath, "junction");
}

function buildPoeProcessHelper(): void {
  const scriptPath = path.resolve(
    __dirname,
    "scripts",
    "build-poe-process-helper.mjs",
  );
  const result = spawnSync(process.execPath, [scriptPath], {
    cwd: __dirname,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error("Failed to build PoE process helper");
  }
}

if (process.platform === "win32") {
  makers.push(
    new MakerSquirrel({
      name: "hinekora",
      authors: "Navali Creations",
      owners: "Navali Creations",
      setupIcon: windowsIcon,
      iconUrl: windowsIconUrl,
    }),
  );
}

if (process.platform === "darwin") {
  makers.push(new MakerZIP({}, ["darwin"]));
}

if (process.platform === "linux") {
  makers.push(
    new MakerRpm({
      options: {
        categories: ["Game"],
        icon: linuxIcon,
      },
    }),
    new MakerDeb({
      options: {
        categories: ["Game"],
        icon: linuxIcon,
      },
    }),
  );
}

const config: ForgeConfig = {
  packagerConfig: {
    asar: {
      unpack: "**/node_modules/noobs/dist/**",
    },
    extraResource: [
      "./renderer/assets/logo",
      "./CHANGELOG.md",
      ...(process.platform === "win32" ? [poeProcessHelperResource] : []),
    ],
    icon: resolvePackagerIcon(),
    prune: false,
    executableName: "hinekora",
    ignore: (file: string) => {
      const normalizedFile = file.replaceAll("\\", "/");
      if (!normalizedFile) {
        return false;
      }

      if (
        normalizedFile === "/node_modules/.bin" ||
        normalizedFile.startsWith("/node_modules/.bin/")
      ) {
        return true;
      }

      if (normalizedFile === "/node_modules") {
        return false;
      }

      if (normalizedFile.startsWith("/node_modules/")) {
        return !packagedNodeModules.some(
          (modulePath) =>
            normalizedFile === modulePath ||
            normalizedFile.startsWith(`${modulePath}/`),
        );
      }

      const keep =
        normalizedFile === "/package.json" ||
        normalizedFile === "/CHANGELOG.md" ||
        normalizedFile.startsWith("/.vite");

      return !keep;
    },
  },
  rebuildConfig: {
    force: true,
  },
  hooks: {
    generateAssets: async () => {
      ensurePackageLocalModule("node-addon-api");
      if (process.platform === "win32") {
        buildPoeProcessHelper();
      }
    },
  },
  makers,
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: "main/index.ts",
          config: "vite.main.config.mts",
          target: "main",
        },
        {
          entry: "renderer/preload.ts",
          config: "vite.preload.config.mts",
          target: "preload",
        },
      ],
      renderer: [
        {
          name: "main_window",
          config: "vite.renderer.config.mts",
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
