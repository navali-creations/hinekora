import {
  type CSSProperties,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";

const editorPreviewAspectRatio = 16 / 9;

interface PreviewFrameSize {
  height: number;
  width: number;
}

function useEditorPreviewFrame() {
  const stageRef = useRef<HTMLDivElement>(null);
  const [frameSize, setFrameSize] = useState<PreviewFrameSize | null>(null);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) {
      return;
    }

    const updateFrameSize = () => {
      const style = window.getComputedStyle(stage);
      const horizontalPadding =
        Number.parseFloat(style.paddingLeft) +
        Number.parseFloat(style.paddingRight);
      const verticalPadding =
        Number.parseFloat(style.paddingTop) +
        Number.parseFloat(style.paddingBottom);
      const nextFrameSize = calculateContainedFrameSize({
        aspectRatio: editorPreviewAspectRatio,
        containerHeight: stage.clientHeight - verticalPadding,
        containerWidth: stage.clientWidth - horizontalPadding,
      });

      setFrameSize((currentFrameSize) => {
        if (
          currentFrameSize?.height === nextFrameSize.height &&
          currentFrameSize.width === nextFrameSize.width
        ) {
          return currentFrameSize;
        }

        return nextFrameSize;
      });
    };

    updateFrameSize();
    const observer = new ResizeObserver(updateFrameSize);
    observer.observe(stage);

    return () => {
      observer.disconnect();
    };
  }, []);

  const frameStyle = useMemo<CSSProperties>(
    () =>
      frameSize
        ? {
            height: `${frameSize.height}px`,
            width: `${frameSize.width}px`,
          }
        : {
            aspectRatio: editorPreviewAspectRatio,
            maxHeight: "100%",
            maxWidth: "100%",
          },
    [frameSize],
  );

  return {
    frameStyle,
    stageRef,
  };
}

function calculateContainedFrameSize(input: {
  aspectRatio: number;
  containerHeight: number;
  containerWidth: number;
}): PreviewFrameSize {
  const containerWidth = Math.max(0, input.containerWidth);
  const containerHeight = Math.max(0, input.containerHeight);
  if (containerWidth === 0 || containerHeight === 0) {
    return { height: 0, width: 0 };
  }

  const containerAspectRatio = containerWidth / containerHeight;
  if (containerAspectRatio > input.aspectRatio) {
    const height = Math.floor(containerHeight);

    return {
      height,
      width: Math.floor(height * input.aspectRatio),
    };
  }

  const width = Math.floor(containerWidth);

  return {
    height: Math.floor(width / input.aspectRatio),
    width,
  };
}

export { useEditorPreviewFrame };
