import { OverlayNotice } from "~/renderer/components/OverlayNotice/OverlayNotice";

interface OverlayExitNoticeProps {
  overlayName: string;
}

function OverlayExitNotice({ overlayName }: OverlayExitNoticeProps) {
  return (
    <OverlayNotice className="top-[22px] text-xs">
      <span className="font-semibold">Press</span>
      <kbd className="kbd kbd-xs font-black">Esc</kbd>
      <span className="font-semibold">to leave {overlayName}.</span>
    </OverlayNotice>
  );
}

export { OverlayExitNotice };
