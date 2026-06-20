import {
  type ExecException,
  type ExecFileOptions,
  execFile,
} from "node:child_process";

const PROCESS_LIST_TIMEOUT_MS = 5_000;
const PROCESS_LIST_MAX_BUFFER_BYTES = 1024 * 1024;

type ExecFileCallback = (
  error: ExecException | null,
  stdout: string | Buffer,
  stderr: string | Buffer,
) => void;

type ExecFileRunner = (
  file: string,
  args: string[],
  options: ExecFileOptions,
  callback: ExecFileCallback,
) => void;

interface ProcessDetectionOptions {
  execFileRunner?: ExecFileRunner;
  platform?: NodeJS.Platform;
}

interface ProcessListCommand {
  command: string;
  args: string[];
}

interface WindowsProcessWindowTitle {
  processName: string;
  windowTitle: string;
}

const DEFAULT_PROCESS_DETECTION_OPTIONS: Required<ProcessDetectionOptions> = {
  execFileRunner: execFile as unknown as ExecFileRunner,
  platform: process.platform,
};

function resolveProcessDetectionOptions(
  options: ProcessDetectionOptions = {},
): Required<ProcessDetectionOptions> {
  return {
    ...DEFAULT_PROCESS_DETECTION_OPTIONS,
    ...options,
  };
}

function resolveProcessListCommand(
  platform: NodeJS.Platform,
): ProcessListCommand | null {
  if (platform === "win32") {
    return { command: "tasklist", args: ["/FO", "CSV", "/NH"] };
  }

  if (platform === "darwin") {
    return { command: "ps", args: ["-ax"] };
  }

  if (platform === "linux") {
    return { command: "ps", args: ["-A"] };
  }

  return null;
}

function parseWindowsTasklistImageNames(output: string): string[] {
  return output.split(/\r?\n/).flatMap((line): string[] => {
    const imageName = parseTasklistCsvImageName(line);

    return imageName ? [imageName] : [];
  });
}

function parseTasklistCsvFields(line: string): string[] | null {
  const trimmed = line.trim();
  if (!trimmed.startsWith('"')) {
    return null;
  }

  const fields: string[] = [];
  let value = "";
  for (let index = 1; index < trimmed.length; index += 1) {
    const char = trimmed[index];
    if (char !== '"') {
      value += char;
      continue;
    }

    if (trimmed[index + 1] === '"') {
      value += '"';
      index += 1;
      continue;
    }

    fields.push(value);
    value = "";

    if (trimmed[index + 1] !== ",") {
      return fields;
    }

    index += 2;
  }

  return null;
}

function parseTasklistCsvImageName(line: string): string | null {
  return parseTasklistCsvFields(line)?.[0] ?? null;
}

function parseWindowsTasklistVerboseWindowTitles(
  output: string,
): WindowsProcessWindowTitle[] {
  return output.split(/\r?\n/).flatMap((line): WindowsProcessWindowTitle[] => {
    const fields = parseTasklistCsvFields(line);
    if (!fields || fields.length < 9) {
      return [];
    }

    const [processName] = fields;
    const windowTitle = fields[8];
    if (!processName || !windowTitle || windowTitle === "N/A") {
      return [];
    }

    return [{ processName, windowTitle }];
  });
}

function parseProcessListOutput(
  output: string,
  platform: NodeJS.Platform,
): string[] {
  if (platform === "win32") {
    return parseWindowsTasklistImageNames(output);
  }

  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function hasProcessName(
  processList: readonly string[],
  processName: string,
  platform: NodeJS.Platform,
): boolean {
  const expected = processName.toLowerCase();
  if (platform === "win32") {
    return processList.some((name) => name.toLowerCase() === expected);
  }

  return processList.some((line) => line.toLowerCase().includes(expected));
}

function runExecFile(
  execFileRunner: ExecFileRunner,
  file: string,
  args: string[],
): Promise<string> {
  return new Promise((resolve) => {
    execFileRunner(
      file,
      args,
      {
        maxBuffer: PROCESS_LIST_MAX_BUFFER_BYTES,
        timeout: PROCESS_LIST_TIMEOUT_MS,
        windowsHide: true,
      },
      (error, stdout) => {
        if (error) {
          resolve("");
          return;
        }

        resolve(stdout.toString());
      },
    );
  });
}

async function listRunningProcesses(
  options: ProcessDetectionOptions = {},
): Promise<string[]> {
  const { execFileRunner, platform } = resolveProcessDetectionOptions(options);
  const command = resolveProcessListCommand(platform);
  if (!command) {
    return [];
  }

  const output = await runExecFile(
    execFileRunner,
    command.command,
    command.args,
  );

  return parseProcessListOutput(output, platform);
}

async function findRunningProcess(
  processNames: readonly string[],
  options: ProcessDetectionOptions = {},
): Promise<string | null> {
  const { platform } = resolveProcessDetectionOptions(options);
  const processList = await listRunningProcesses(options);

  return (
    processNames.find((processName) =>
      hasProcessName(processList, processName, platform),
    ) ?? null
  );
}

async function listWindowsProcessWindowTitles(
  processName: string,
  options: ProcessDetectionOptions = {},
): Promise<WindowsProcessWindowTitle[]> {
  const { execFileRunner, platform } = resolveProcessDetectionOptions(options);
  if (platform !== "win32") {
    return [];
  }

  const output = await runExecFile(execFileRunner, "tasklist", [
    "/FI",
    `IMAGENAME eq ${processName}`,
    "/V",
    "/FO",
    "CSV",
    "/NH",
  ]);
  const expected = processName.toLowerCase();

  return parseWindowsTasklistVerboseWindowTitles(output).filter(
    (processWindow) => processWindow.processName.toLowerCase() === expected,
  );
}

async function isProcessRunning(
  processName: string,
  options: ProcessDetectionOptions = {},
): Promise<boolean> {
  return (await findRunningProcess([processName], options)) !== null;
}

export type {
  ExecFileRunner,
  ProcessDetectionOptions,
  WindowsProcessWindowTitle,
};
export {
  findRunningProcess,
  hasProcessName,
  isProcessRunning,
  listRunningProcesses,
  listWindowsProcessWindowTitles,
  parseTasklistCsvFields,
  parseTasklistCsvImageName,
  parseWindowsTasklistImageNames,
  parseWindowsTasklistVerboseWindowTitles,
  resolveProcessDetectionOptions,
  resolveProcessListCommand,
};
