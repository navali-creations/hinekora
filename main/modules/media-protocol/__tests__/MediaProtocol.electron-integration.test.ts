import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import ts from "typescript";
import { afterEach, describe, expect, it } from "vitest";

const temporaryDirectories: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryDirectories
      .splice(0)
      .map((path) => rm(path, { force: true, recursive: true })),
  );
});

describe.runIf(process.platform === "win32")(
  "hinekora media Electron integration",
  () => {
    it("streams native file ranges through the custom protocol", async () => {
      const root = await mkdtemp(join(tmpdir(), "hinekora-media-probe-"));
      temporaryDirectories.push(root);
      const mediaPath = join(root, "probe.mp4");
      await writeFile(mediaPath, "0123456789");
      const mediaModulePath = await transpileMediaModules(root);
      const result = await runElectronProbe(mediaModulePath, mediaPath);

      expect(result).toEqual({
        body: "2345",
        cacheControl: "no-store",
        contentLength: "4",
        contentRange: "bytes 2-5/10",
        status: 206,
      });
    }, 20_000);
  },
);

async function transpileMediaModules(outputDirectory: string): Promise<string> {
  const sourceDirectory = resolve("main/modules/media-protocol");
  for (const fileName of [
    "MediaProtocol.range.ts",
    "MediaProtocol.response.ts",
  ]) {
    const source = await readFile(join(sourceDirectory, fileName), "utf8");
    const output = ts.transpileModule(source, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
      },
      fileName,
    }).outputText;
    await writeFile(
      join(outputDirectory, fileName.replace(/\.ts$/, ".js")),
      output,
      "utf8",
    );
  }

  return join(outputDirectory, "MediaProtocol.response.js");
}

async function runElectronProbe(
  mediaModulePath: string,
  mediaPath: string,
): Promise<Record<string, unknown>> {
  const require = createRequire(import.meta.url);
  const electronPackagePath = require.resolve("electron/package.json");
  const electronPath = join(
    dirname(electronPackagePath),
    "dist",
    "electron.exe",
  );
  const fixturePath = resolve("main/test/electron-media-range-probe.cjs");
  const environment = { ...process.env };
  delete environment.ELECTRON_RUN_AS_NODE;

  return new Promise((resolveResult, reject) => {
    const child = spawn(
      electronPath,
      [fixturePath, mediaModulePath, mediaPath],
      { env: environment, windowsHide: true },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr || `Electron media probe exited ${code}`));
        return;
      }

      const marker = "HINEKORA_MEDIA_RESULT:";
      const resultLine = stdout
        .split(/\r?\n/)
        .find((line) => line.startsWith(marker));
      if (!resultLine) {
        reject(new Error(`Electron media probe returned no result: ${stdout}`));
        return;
      }
      resolveResult(JSON.parse(resultLine.slice(marker.length)));
    });
  });
}
