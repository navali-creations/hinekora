import type { AppSetupStep, GameId } from "~/types";

const SETUP_STEPS = {
  NOT_STARTED: 0,
  SELECT_GAME: 1,
  SELECT_CLIENT_PATH: 2,
  TELEMETRY_CONSENT: 3,
} as const satisfies Record<string, AppSetupStep>;

type GameSelectionType = "poe1_only" | "poe2_only" | "both";

function getGameSelectionType(games: GameId[]): GameSelectionType {
  const hasPoe1 = games.includes("poe1");
  const hasPoe2 = games.includes("poe2");

  if (hasPoe1 && hasPoe2) {
    return "both";
  }

  if (hasPoe2) {
    return "poe2_only";
  }

  return "poe1_only";
}

type SetupState = {
  currentStep: AppSetupStep;
  isComplete: boolean;
  selectedGames: GameId[];
  poe1ClientPath: string | null;
  poe2ClientPath: string | null;
  telemetryCrashReporting: boolean;
  telemetryUsageAnalytics: boolean;
};

type StepValidationResult = {
  isValid: boolean;
  errors: string[];
};

type AppSetupResult = {
  success: boolean;
  error?: string;
};

export type {
  AppSetupResult,
  GameSelectionType,
  SetupState,
  StepValidationResult,
};
export { getGameSelectionType, SETUP_STEPS };
