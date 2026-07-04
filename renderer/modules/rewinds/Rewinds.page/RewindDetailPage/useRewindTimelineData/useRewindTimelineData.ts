import { useEffect, useState } from "react";

import type { ActivitySessionTimeline } from "~/main/modules/bookmarks";

interface RewindDetailState {
  error: string | null;
  isLoading: boolean;
  timeline: ActivitySessionTimeline | null;
}

const initialRewindDetailState: RewindDetailState = {
  error: null,
  isLoading: true,
  timeline: null,
};

function useRewindTimelineData(rewindId: string): RewindDetailState {
  const [state, setState] = useState(initialRewindDetailState);

  useEffect(() => {
    let isActive = true;
    setState(initialRewindDetailState);

    window.electron.bookmarks
      .getActivitySessionTimeline(rewindId)
      .then((timeline) => {
        if (isActive) {
          setState({ error: null, isLoading: false, timeline });
        }
      })
      .catch((error: unknown) => {
        if (isActive) {
          setState({
            error: error instanceof Error ? error.message : "Rewind failed",
            isLoading: false,
            timeline: null,
          });
        }
      });

    return () => {
      isActive = false;
    };
  }, [rewindId]);

  return state;
}

export type { RewindDetailState };
export { useRewindTimelineData };
