function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return false;
    }

    if (hostname === "github.com") {
      return true;
    }

    if (hostname === "pathofexile.com" || hostname === "www.pathofexile.com") {
      return true;
    }

    return (
      hostname === "discord.gg" &&
      url.pathname.replace(/\/$/, "") === "/mrqmPYXHHT"
    );
  } catch {
    return false;
  }
}

export { isAllowedExternalUrl };
