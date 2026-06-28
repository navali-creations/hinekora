function createAuraPreviewConstraints(
  sourceId: string,
): MediaStreamConstraints {
  return {
    audio: false,
    video: {
      mandatory: {
        chromeMediaSource: "desktop",
        chromeMediaSourceId: sourceId,
        maxWidth: 7680,
        maxHeight: 4320,
        maxFrameRate: 60,
      },
    } as unknown as MediaTrackConstraints,
  };
}

export { createAuraPreviewConstraints };
