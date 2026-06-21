import { useCallback, useEffect, useRef, useState } from "react";
import { FiExternalLink, FiGithub } from "react-icons/fi";
import { RiDiscordLine } from "react-icons/ri";

import { OnboardingButton } from "~/renderer/modules/onboarding";
import { useOnboardingMutationRefresh } from "~/renderer/modules/onboarding/Onboarding.hooks/useOnboardingMutationRefresh/useOnboardingMutationRefresh";
import {
  allOnboardingBeaconIds,
  type OnboardingBeaconId,
} from "~/renderer/modules/onboarding/onboarding-config/onboarding-labels";
import { trackEvent } from "~/renderer/modules/umami";
import { useOnboardingActions, useOnboardingState } from "~/renderer/store";

import { BeaconManagementList } from "./BeaconManagementList/BeaconManagementList";

const DISMISS_ALL_BADGE_DURATION_MS = 2_000;
const DISCORD_URL = "https://discord.gg/mrqmPYXHHT";
const REPO_URL = "https://github.com/navali-creations/hinekora";

function HelpSettingsCard() {
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const [showDismissedBadge, setShowDismissedBadge] = useState(false);
  const dismissBadgeTimeoutRef = useRef<number | null>(null);
  const { dismissAll, dismiss, resetOne } = useOnboardingActions();
  const { dismissedBeacons } = useOnboardingState();
  const runOnboardingMutation = useOnboardingMutationRefresh();

  const dismissedBeaconSet = new Set(dismissedBeacons);
  const beaconStates = allOnboardingBeaconIds.map((id) => ({
    id,
    dismissed: dismissedBeaconSet.has(id),
  }));
  const dismissedCount = beaconStates.filter(
    (beacon) => beacon.dismissed,
  ).length;
  const visibleCount = allOnboardingBeaconIds.length - dismissedCount;
  const visiblePercentage =
    allOnboardingBeaconIds.length > 0
      ? (visibleCount / allOnboardingBeaconIds.length) * 100
      : 0;
  const allDismissed =
    beaconStates.length > 0 && dismissedCount === allOnboardingBeaconIds.length;

  const handleDismissBeacon = useCallback(
    async (key: OnboardingBeaconId) => {
      await runOnboardingMutation(() => dismiss(key));
    },
    [dismiss, runOnboardingMutation],
  );

  const handleResetBeacon = useCallback(
    async (key: OnboardingBeaconId) => {
      await runOnboardingMutation(() => resetOne(key));
    },
    [resetOne, runOnboardingMutation],
  );

  const handleDismissAllBeacons = useCallback(async () => {
    setIsDismissingAll(true);

    try {
      const didDismiss = await runOnboardingMutation(() => dismissAll());

      if (!didDismiss) {
        return;
      }

      trackEvent("onboarding-all-dismissed", {
        source: "settings",
      });
      setShowDismissedBadge(true);

      if (dismissBadgeTimeoutRef.current !== null) {
        window.clearTimeout(dismissBadgeTimeoutRef.current);
      }

      dismissBadgeTimeoutRef.current = window.setTimeout(() => {
        setShowDismissedBadge(false);
      }, DISMISS_ALL_BADGE_DURATION_MS);
    } catch (error) {
      console.error("Failed to dismiss all onboarding beacons:", error);
    } finally {
      setIsDismissingAll(false);
    }
  }, [dismissAll, runOnboardingMutation]);

  useEffect(() => {
    return () => {
      if (dismissBadgeTimeoutRef.current !== null) {
        window.clearTimeout(dismissBadgeTimeoutRef.current);
      }
    };
  }, []);

  return (
    <section className="col-span-12 space-y-8">
      <p className="sr-only">Help settings</p>

      <div className="divide-y divide-base-content/10">
        <div className="flex items-start justify-between gap-4 py-4">
          <div>
            <h2 className="font-semibold">Discord</h2>
            <p className="mt-1 text-base-content/60 text-sm">
              Join the community for questions, feedback, and release help.
            </p>
          </div>
          <a
            aria-label="Open Discord"
            className="btn btn-outline btn-sm"
            href={DISCORD_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <RiDiscordLine />
            Open
            <FiExternalLink />
          </a>
        </div>

        <div className="flex items-start justify-between gap-4 py-4">
          <div>
            <h2 className="font-semibold">GitHub</h2>
            <p className="mt-1 text-base-content/60 text-sm">
              View source, releases, issues, and project discussions.
            </p>
          </div>
          <a
            aria-label="Open GitHub"
            className="btn btn-outline btn-sm"
            href={REPO_URL}
            rel="noopener noreferrer"
            target="_blank"
          >
            <FiGithub />
            Open
            <FiExternalLink />
          </a>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h2 className="font-semibold">Interactive beacons</h2>
            <p className="mt-1 text-base-content/60 text-sm">
              Interactive beacons guide you through Hinekora&apos;s features.
              <span className="block">
                Dismissed a beacon? Reset the tour to see them all again.
              </span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex flex-wrap justify-end gap-2">
              <button
                className="btn btn-ghost btn-sm"
                disabled={isDismissingAll || allDismissed}
                type="button"
                onClick={handleDismissAllBeacons}
              >
                {isDismissingAll ? "Dismissing..." : "Dismiss All Beacons"}
              </button>
              <OnboardingButton size="sm" />
            </div>
            {showDismissedBadge && (
              <span className="badge badge-success badge-sm">
                All dismissed
              </span>
            )}
          </div>
        </div>

        <div className="border-base-content/10 border-t pt-4">
          <div className="mb-4 flex items-start justify-between gap-4">
            <div>
              <h2 className="font-semibold text-sm">Manage beacons</h2>
              <p className="mt-1 text-base-content/60 text-sm">
                Toggle on keeps a beacon visible in the tour. Toggle off
                dismisses it until you reset it.
              </p>
            </div>
            <div className="w-36 shrink-0 text-right">
              <div className="font-medium text-base-content/60 text-xs">
                {visibleCount} / {allOnboardingBeaconIds.length} visible
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-base-300">
                <div
                  className="h-full rounded-full bg-primary"
                  style={{ width: `${visiblePercentage}%` }}
                />
              </div>
            </div>
          </div>

          <BeaconManagementList
            beaconStates={beaconStates}
            onDismiss={handleDismissBeacon}
            onReset={handleResetBeacon}
          />
        </div>
      </div>
    </section>
  );
}

export { HelpSettingsCard };
