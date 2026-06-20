interface DisplayLike {
  id: number;
  size: {
    width: number;
    height: number;
  };
  scaleFactor: number;
}

interface DisplayDimensions {
  width: number;
  height: number;
}

function getNativeDisplayDimensions(display: DisplayLike): DisplayDimensions {
  return {
    width: Math.round(display.size.width * display.scaleFactor),
    height: Math.round(display.size.height * display.scaleFactor),
  };
}

function createDisplayDimensionsLookup(
  displays: DisplayLike[],
): Map<string, DisplayDimensions> {
  return new Map(
    displays.map((display) => [
      String(display.id),
      getNativeDisplayDimensions(display),
    ]),
  );
}

export type { DisplayDimensions, DisplayLike };
export { createDisplayDimensionsLookup, getNativeDisplayDimensions };
