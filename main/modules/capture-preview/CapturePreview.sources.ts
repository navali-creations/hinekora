import type { CapturePreviewSource } from "~/types";

interface CapturePreviewSourceInput {
  id: string;
  name: string;
  displayId: string | null;
  width: number | null;
  height: number | null;
  thumbnailDataUrl: string | null;
}

function normalizeCapturePreviewSources(
  sources: CapturePreviewSourceInput[],
): CapturePreviewSource[] {
  let screenIndex = 0;
  const seenPoeGames = new Set<"poe1" | "poe2">();

  return sources.flatMap((source): CapturePreviewSource[] => {
    if (source.id.startsWith("screen:")) {
      screenIndex += 1;

      return [
        {
          id: source.id,
          name: `Screen ${screenIndex}`,
          kind: "screen",
          displayId: source.displayId,
          width: source.width,
          height: source.height,
          thumbnailDataUrl: source.thumbnailDataUrl,
        },
      ];
    }

    const poeGame = detectPathOfExileWindowTitle(source.name);
    if (!poeGame) {
      return [];
    }

    if (seenPoeGames.has(poeGame)) {
      return [];
    }
    seenPoeGames.add(poeGame);

    const label = poeGame === "poe2" ? "Path of Exile 2" : "Path of Exile 1";

    return [
      {
        id: source.id,
        name: label,
        kind: "window",
        displayId: null,
        width: source.width,
        height: source.height,
        thumbnailDataUrl: source.thumbnailDataUrl,
      },
    ];
  });
}

function detectPathOfExileWindowTitle(name: string): "poe1" | "poe2" | null {
  const normalized = name.trim().replace(/\s+/g, " ").toLowerCase();
  if (normalized === "path of exile 2") {
    return "poe2";
  }

  if (normalized === "path of exile") {
    return "poe1";
  }

  return null;
}

export type { CapturePreviewSourceInput };
export { detectPathOfExileWindowTitle, normalizeCapturePreviewSources };
