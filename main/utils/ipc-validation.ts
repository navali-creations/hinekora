class IpcValidationError extends Error {
  constructor(
    public readonly channel: string,
    message: string,
  ) {
    super(message);
    this.name = "IpcValidationError";
  }
}

export function assertString(
  value: unknown,
  field: string,
  channel: string,
  options: { min?: number; max?: number } = {},
): asserts value is string {
  if (typeof value !== "string") {
    throw new IpcValidationError(channel, `${field} must be a string`);
  }

  if (options.min !== undefined && value.length < options.min) {
    throw new IpcValidationError(channel, `${field} is too short`);
  }

  if (options.max !== undefined && value.length > options.max) {
    throw new IpcValidationError(channel, `${field} is too long`);
  }
}

export function assertNumber(
  value: unknown,
  field: string,
  channel: string,
  options: { min?: number; max?: number; integer?: boolean } = {},
): asserts value is number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new IpcValidationError(channel, `${field} must be a number`);
  }

  if (options.integer === true && !Number.isInteger(value)) {
    throw new IpcValidationError(channel, `${field} must be an integer`);
  }

  if (options.min !== undefined && value < options.min) {
    throw new IpcValidationError(channel, `${field} is too small`);
  }

  if (options.max !== undefined && value > options.max) {
    throw new IpcValidationError(channel, `${field} is too large`);
  }
}

export function assertOptionalBoolean(
  value: unknown,
  field: string,
  channel: string,
): asserts value is boolean | undefined {
  if (value !== undefined && typeof value !== "boolean") {
    throw new IpcValidationError(channel, `${field} must be a boolean`);
  }
}

export function assertObject(
  value: unknown,
  field: string,
  channel: string,
): asserts value is Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new IpcValidationError(channel, `${field} must be an object`);
  }
}

export function safeErrorMessage(error: unknown): string {
  if (error instanceof IpcValidationError) {
    return error.message;
  }

  if (error instanceof Error && error.message.length <= 512) {
    return redactLocalPaths(error.message);
  }

  return "Operation failed";
}

function redactLocalPaths(message: string): string {
  return message
    .replace(
      /(["'])(?:(?:[A-Za-z]:[\\/])|(?:\\\\)|(?:\/(?:Users|home|tmp|var|private|mnt)\/))[^"']+\1/g,
      "$1[path]$1",
    )
    .replace(
      /(?:(?:[A-Za-z]:[\\/])|(?:\\\\)|(?:\/(?:Users|home|tmp|var|private|mnt)\/))[^\s"',;]+/g,
      "[path]",
    );
}

export function handleValidationError(error: unknown): {
  ok: false;
  error: string;
} {
  return {
    ok: false,
    error: safeErrorMessage(error),
  };
}

export { IpcValidationError };
