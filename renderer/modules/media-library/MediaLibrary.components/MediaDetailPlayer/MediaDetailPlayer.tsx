interface MediaDetailPlayerProps {
  emptyDescription: string;
  emptyTitle: string;
  mediaUrl: string | null;
  title: string;
}

function MediaDetailPlayer({
  emptyDescription,
  emptyTitle,
  mediaUrl,
  title,
}: MediaDetailPlayerProps) {
  if (!mediaUrl) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center rounded-lg bg-base-200 text-center">
        <div className="font-semibold text-base-content">{emptyTitle}</div>
        <p className="mt-2 max-w-md text-base-content/60 text-sm">
          {emptyDescription}
        </p>
      </div>
    );
  }

  return (
    <video
      className="aspect-video w-full rounded-lg bg-black"
      controls
      preload="metadata"
      src={mediaUrl}
      title={title}
    />
  );
}

export { MediaDetailPlayer };
