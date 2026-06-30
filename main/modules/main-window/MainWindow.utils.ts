import { ATTRIBUTIONS } from "~/types/attributions";

import { HINEKORA_DISCORD_URL, HINEKORA_GITHUB_URL } from "~/types";

const hinekoraDiscordPathname = new URL(HINEKORA_DISCORD_URL).pathname.replace(
  /\/$/,
  "",
);
const hinekoraGithubHostname = new URL(
  HINEKORA_GITHUB_URL,
).hostname.toLowerCase();
const hinekoraGithubPathname = new URL(HINEKORA_GITHUB_URL).pathname
  .replace(/\/$/, "")
  .toLowerCase();
const allowedAttributionUrls = new Set(
  ATTRIBUTIONS.map((attribution) =>
    normalizeAllowlistedExternalUrl(new URL(attribution.url)),
  ),
);

function normalizeAllowlistedExternalUrl(url: URL): string {
  return [
    url.protocol,
    "//",
    url.hostname.toLowerCase(),
    url.pathname.replace(/\/$/, "").toLowerCase(),
  ].join("");
}

function isAllowedExternalUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();

    if (url.protocol !== "https:") {
      return false;
    }

    const pathname = url.pathname.replace(/\/$/, "").toLowerCase();
    const normalizedUrl = normalizeAllowlistedExternalUrl(url);

    if (
      url.search.length === 0 &&
      url.hash.length === 0 &&
      allowedAttributionUrls.has(normalizedUrl)
    ) {
      return true;
    }

    if (
      hostname === hinekoraGithubHostname &&
      (pathname === hinekoraGithubPathname ||
        pathname.startsWith(`${hinekoraGithubPathname}/`))
    ) {
      return true;
    }

    if (hostname === "pathofexile.com" || hostname === "www.pathofexile.com") {
      return true;
    }

    if (
      hostname === "warcraftrecorder.com" ||
      hostname === "www.warcraftrecorder.com"
    ) {
      return true;
    }

    return (
      hostname === "discord.gg" &&
      url.pathname.replace(/\/$/, "") === hinekoraDiscordPathname
    );
  } catch {
    return false;
  }
}

export { isAllowedExternalUrl };
