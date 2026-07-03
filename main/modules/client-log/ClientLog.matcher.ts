import { createHash } from "node:crypto";

import type { ClientLogActivityEvent } from "./ClientLog.dto";

const DEFAULT_DEATH_PATTERNS = [/\bhas been slain\b/i, /\bwas slain\b/i];
const IGNORED_CHAT_PREFIXES = new Set(["#", "%", "$"]);
const FOCUS_GAINED_MESSAGE = "[WINDOW] Gained focus";
const FOCUS_LOST_MESSAGE = "[WINDOW] Lost focus";
const LOG_FILE_OPENING_MARKER = "***** LOG FILE OPENING *****";
const CLOSING_GAME_MESSAGE = "Closing game gracefully";
const IGNORED_SCENE_SOURCES = new Set(["Interlude"]);
const CLIENT_LOG_HEADER_PATTERN =
  /^(\d{4})\/(\d{2})\/(\d{2})\s+(\d{2}):(\d{2}):(\d{2})\s+(\d+)\s+[0-9a-f]+\s+\[[^\]]+\]\s*(.*)$/i;
const GENERATED_AREA_PATTERN =
  /\bGenerating level(?:\s+\d+)?\s+area\s+"([^"]+)"/i;
const SCENE_SOURCE_PATTERN = /^\[SCENE\]\s+Set Source\s+\[([^\]]+)\]/i;

interface ClientLogFocusEvent {
  focused: boolean;
  line: string;
}

interface ClientLogParseOptions {
  characterName?: string | null;
}

interface ParsedClientLogEvents {
  activityEvents: ClientLogActivityEvent[];
  deathLines: string[];
  focusEvents: ClientLogFocusEvent[];
}

function extractMessage(line: string): string {
  const messageStart = line.indexOf("]");

  return messageStart === -1 ? line : line.slice(messageStart + 1);
}

function isIgnoredChatMessage(message: string): boolean {
  return IGNORED_CHAT_PREFIXES.has(message[0] ?? "");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function matchesConfiguredCharacterDeath(
  message: string,
  characterName: string,
): boolean {
  const trimmedCharacterName = characterName.trim();
  if (!trimmedCharacterName) {
    return true;
  }

  const characterPattern = new RegExp(
    `(?:^|:\\s*)${escapeRegExp(trimmedCharacterName)}\\s+(?:has been slain|was slain)\\.?$`,
    "i",
  );

  return characterPattern.test(message);
}

function parseClientLogEvents(
  text: string,
  options: ClientLogParseOptions = {},
): ParsedClientLogEvents {
  const activityEvents: ClientLogActivityEvent[] = [];
  const deathLines: string[] = [];
  const focusEvents: ClientLogFocusEvent[] = [];
  const characterName = options.characterName?.trim() ?? "";

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.includes(LOG_FILE_OPENING_MARKER)) {
      focusEvents.push({ focused: true, line });
      continue;
    }

    const message = extractMessage(line).trim();
    const activityEvent = parseActivityEvent(line, message);
    if (activityEvent) {
      activityEvents.push(activityEvent);
    }

    if (message === FOCUS_GAINED_MESSAGE) {
      focusEvents.push({ focused: true, line });
    } else if (message === FOCUS_LOST_MESSAGE) {
      focusEvents.push({ focused: false, line });
    } else if (message === CLOSING_GAME_MESSAGE) {
      focusEvents.push({ focused: false, line });
    }

    if (
      !isIgnoredChatMessage(message) &&
      DEFAULT_DEATH_PATTERNS.some((pattern) => pattern.test(line)) &&
      matchesConfiguredCharacterDeath(message, characterName)
    ) {
      deathLines.push(line);
    }
  }

  return { activityEvents, deathLines, focusEvents };
}

function findDeathLines(
  text: string,
  options: ClientLogParseOptions = {},
): string[] {
  return parseClientLogEvents(text, options).deathLines;
}

function findFocusEvents(text: string): ClientLogFocusEvent[] {
  return parseClientLogEvents(text).focusEvents;
}

function findLatestFocusState(text: string): boolean | null {
  let latest: boolean | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (line.includes(LOG_FILE_OPENING_MARKER)) {
      latest = true;
      continue;
    }

    const message = extractMessage(line).trim();
    if (message === FOCUS_GAINED_MESSAGE) {
      latest = true;
    } else if (message === FOCUS_LOST_MESSAGE) {
      latest = false;
    } else if (message === CLOSING_GAME_MESSAGE) {
      latest = false;
    }
  }

  return latest;
}

function hashDeathLine(line: string): string {
  return createHash("sha256").update(line).digest("hex").slice(0, 32);
}

function parseActivityEvent(
  line: string,
  message: string,
): ClientLogActivityEvent | null {
  if (isIgnoredChatMessage(message)) {
    return null;
  }

  const header = CLIENT_LOG_HEADER_PATTERN.exec(line);
  if (!header) {
    return null;
  }

  const occurredAt = new Date(
    Number(header[1]),
    Number(header[2]) - 1,
    Number(header[3]),
    Number(header[4]),
    Number(header[5]),
    Number(header[6]),
  ).toISOString();
  const sequenceId = header[7];
  if (!sequenceId) {
    return null;
  }
  const generatedAreaMatch = GENERATED_AREA_PATTERN.exec(message);
  if (generatedAreaMatch) {
    const areaId = generatedAreaMatch[1];
    if (!areaId) {
      return null;
    }

    return {
      areaId,
      kind: "generated-area",
      line,
      occurredAt,
      sequenceId,
    };
  }

  const sceneSourceMatch = SCENE_SOURCE_PATTERN.exec(message);
  if (!sceneSourceMatch) {
    return null;
  }

  const sceneSource = sceneSourceMatch[1];
  if (!sceneSource) {
    return null;
  }

  const sceneName = sceneSource.trim();
  if (
    IGNORED_SCENE_SOURCES.has(sceneName) ||
    (sceneName.startsWith("(") && sceneName.endsWith(")"))
  ) {
    return null;
  }

  return {
    kind: "scene-source",
    line,
    occurredAt,
    sceneName,
    sequenceId,
  };
}

export type {
  ClientLogFocusEvent,
  ClientLogParseOptions,
  ParsedClientLogEvents,
};
export {
  findDeathLines,
  findFocusEvents,
  findLatestFocusState,
  hashDeathLine,
  parseClientLogEvents,
};
