import { createHash } from "node:crypto";

const DEFAULT_DEATH_PATTERNS = [
  /\byou have died\b/i,
  /\bhas been slain\b/i,
  /\bwas slain\b/i,
];
const IGNORED_CHAT_PREFIXES = new Set(["#", "%", "$"]);
const FOCUS_GAINED_MESSAGE = "[WINDOW] Gained focus";
const FOCUS_LOST_MESSAGE = "[WINDOW] Lost focus";

interface ClientLogFocusEvent {
  focused: boolean;
  line: string;
}

interface ParsedClientLogEvents {
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

function parseClientLogEvents(text: string): ParsedClientLogEvents {
  const deathLines: string[] = [];
  const focusEvents: ClientLogFocusEvent[] = [];

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    const message = extractMessage(line).trim();

    if (message === FOCUS_GAINED_MESSAGE) {
      focusEvents.push({ focused: true, line });
    } else if (message === FOCUS_LOST_MESSAGE) {
      focusEvents.push({ focused: false, line });
    }

    if (
      !isIgnoredChatMessage(message) &&
      DEFAULT_DEATH_PATTERNS.some((pattern) => pattern.test(line))
    ) {
      deathLines.push(line);
    }
  }

  return { deathLines, focusEvents };
}

function findDeathLines(text: string): string[] {
  return parseClientLogEvents(text).deathLines;
}

function findFocusEvents(text: string): ClientLogFocusEvent[] {
  return parseClientLogEvents(text).focusEvents;
}

function findLatestFocusState(text: string): boolean | null {
  let latest: boolean | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const message = extractMessage(rawLine.trim()).trim();
    if (message === FOCUS_GAINED_MESSAGE) {
      latest = true;
    } else if (message === FOCUS_LOST_MESSAGE) {
      latest = false;
    }
  }

  return latest;
}

function hashDeathLine(line: string): string {
  return createHash("sha256").update(line).digest("hex").slice(0, 32);
}

export type { ClientLogFocusEvent, ParsedClientLogEvents };
export {
  findDeathLines,
  findFocusEvents,
  findLatestFocusState,
  hashDeathLine,
  parseClientLogEvents,
};
