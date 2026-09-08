import {
  WINDOW_ROLE_ARGUMENT_PREFIX,
  WindowName,
} from "~/main/modules/main-window/MainWindow.types";

const windowNames = new Set<string>(Object.values(WindowName));
const trustedDevelopmentHosts = new Set(["127.0.0.1", "[::1]", "localhost"]);

function isTrustedRendererUrl(value: string): boolean {
  try {
    const url = new URL(value);
    if (url.protocol === "file:") {
      return true;
    }

    return (
      (url.protocol === "http:" || url.protocol === "https:") &&
      trustedDevelopmentHosts.has(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

function readPreloadWindowName(argv: readonly string[]): WindowName | null {
  const roleArgument = argv.find((argument) =>
    argument.startsWith(WINDOW_ROLE_ARGUMENT_PREFIX),
  );
  if (!roleArgument) {
    return null;
  }

  const value = roleArgument.slice(WINDOW_ROLE_ARGUMENT_PREFIX.length);
  return windowNames.has(value) ? (value as WindowName) : null;
}

export { isTrustedRendererUrl, readPreloadWindowName };
