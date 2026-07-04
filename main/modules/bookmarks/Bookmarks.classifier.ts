import type { BookmarkCategory, BookmarkSubcategory } from "./Bookmarks.dto";

interface BookmarkLocationClassification {
  category: BookmarkCategory;
  subcategory: BookmarkSubcategory;
}

const trialSceneNames = new Set([
  "Trial of the Sekhemas",
  "The Trial of Chaos",
]);

function classifyBookmarkLocation(input: {
  areaId: string | null;
  sceneName: string;
}): BookmarkLocationClassification {
  const areaId = input.areaId ?? "";
  const sceneName = input.sceneName.trim();

  if (sceneName === "Abyssal Depths") {
    return { category: "map", subcategory: "abyss-depths" };
  }

  if (trialSceneNames.has(sceneName)) {
    return { category: "map", subcategory: "trial" };
  }

  if (isTownArea(areaId)) {
    return { category: "town", subcategory: null };
  }

  if (isPinnacleArea(areaId)) {
    return { category: "pinnacle", subcategory: null };
  }

  if (isHideoutArea(areaId, sceneName)) {
    return { category: "hideout", subcategory: null };
  }

  if (isBossArea(areaId)) {
    return { category: "boss", subcategory: null };
  }

  return { category: "map", subcategory: null };
}

function isTownArea(areaId: string): boolean {
  return /(^|_)(town|hub)($|_)/i.test(areaId);
}

function isPinnacleArea(areaId: string): boolean {
  return /^MapUberBoss_/i.test(areaId) || areaId === "Abyss_Pinnacle";
}

function isHideoutArea(areaId: string, sceneName: string): boolean {
  return /hideout/i.test(areaId) && !/^MapHideout/i.test(areaId)
    ? true
    : /hideout/i.test(sceneName) && !/^MapHideout/i.test(areaId);
}

function isBossArea(areaId: string): boolean {
  return /boss/i.test(areaId);
}

export type { BookmarkLocationClassification };
export { classifyBookmarkLocation };
