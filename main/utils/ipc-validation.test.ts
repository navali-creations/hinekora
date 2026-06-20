import { describe, expect, it } from "vitest";

import {
  assertNumber,
  assertObject,
  assertOptionalBoolean,
  assertString,
  handleValidationError,
  IpcValidationError,
  safeErrorMessage,
} from "./ipc-validation";

describe("IPC validation utilities", () => {
  it("preserves validation messages for renderer callers", () => {
    expect(
      handleValidationError(
        new IpcValidationError("test:channel", "id is too long"),
      ),
    ).toEqual({
      ok: false,
      error: "id is too long",
    });
  });

  it("redacts local paths from operational errors", () => {
    expect(
      safeErrorMessage(
        new Error(
          "ENOENT: no such file or directory, open 'C:\\Users\\seb\\Videos\\clip.mp4'",
        ),
      ),
    ).toBe("ENOENT: no such file or directory, open '[path]'");
  });

  it("uses a generic message for unsafe error payloads", () => {
    expect(safeErrorMessage("plain string failure")).toBe("Operation failed");
    expect(safeErrorMessage(new Error("x".repeat(513)))).toBe(
      "Operation failed",
    );
  });

  it("validates bounded strings", () => {
    expect(() =>
      assertString("abc", "id", "test", { min: 1, max: 3 }),
    ).not.toThrow();
    expect(() => assertString(123, "id", "test")).toThrow(
      "id must be a string",
    );
    expect(() => assertString("", "id", "test", { min: 1 })).toThrow(
      "id is too short",
    );
    expect(() => assertString("abcd", "id", "test", { max: 3 })).toThrow(
      "id is too long",
    );
  });

  it("validates bounded numbers", () => {
    expect(() =>
      assertNumber(3, "count", "test", { integer: true, min: 1, max: 5 }),
    ).not.toThrow();
    expect(() => assertNumber(Number.NaN, "count", "test")).toThrow(
      "count must be a number",
    );
    expect(() => assertNumber(1.5, "count", "test", { integer: true })).toThrow(
      "count must be an integer",
    );
    expect(() => assertNumber(0, "count", "test", { min: 1 })).toThrow(
      "count is too small",
    );
    expect(() => assertNumber(6, "count", "test", { max: 5 })).toThrow(
      "count is too large",
    );
  });

  it("validates optional booleans", () => {
    expect(() =>
      assertOptionalBoolean(undefined, "forceRefresh", "test"),
    ).not.toThrow();
    expect(() =>
      assertOptionalBoolean(true, "forceRefresh", "test"),
    ).not.toThrow();
    expect(() => assertOptionalBoolean("true", "forceRefresh", "test")).toThrow(
      "forceRefresh must be a boolean",
    );
  });

  it("validates plain objects", () => {
    expect(() => assertObject({ ok: true }, "payload", "test")).not.toThrow();
    expect(() => assertObject(null, "payload", "test")).toThrow(
      "payload must be an object",
    );
    expect(() => assertObject([], "payload", "test")).toThrow(
      "payload must be an object",
    );
  });
});
