import { type PopoverComponentProps, ReperePopover } from "@repere/react";
import type { ReactNode } from "react";
import { useState } from "react";

import { trackEvent } from "~/renderer/modules/umami";
import { useOnboardingActions } from "~/renderer/store";

import { useOnboardingMutationRefresh } from "../../Onboarding.hooks/useOnboardingMutationRefresh/useOnboardingMutationRefresh";

type PopoverProps = {
  title: string;
  subtitle?: string;
  children: ReactNode;
  className?: string;
} & PopoverComponentProps;

function Popover({
  title,
  subtitle,
  children,
  className,
  ...props
}: PopoverProps) {
  const [isDismissingAll, setIsDismissingAll] = useState(false);
  const { dismissAll } = useOnboardingActions();
  const runOnboardingMutation = useOnboardingMutationRefresh();

  const handleAcknowledge = () => {
    trackEvent("onboarding-step-acknowledged", {
      beaconId: props.beaconId,
    });
  };

  const handleDismissAll = async () => {
    setIsDismissingAll(true);

    try {
      const didDismiss = await runOnboardingMutation(() => dismissAll());

      if (didDismiss) {
        trackEvent("onboarding-all-dismissed", {
          source: "popover",
          beaconId: props.beaconId,
        });
      }
    } catch (error) {
      console.error("Failed to dismiss all onboarding beacons:", error);
    } finally {
      setIsDismissingAll(false);
    }
  };

  return (
    <ReperePopover
      {...props}
      className={`w-[400px] rounded-2xl border-2 border-primary p-3 shadow-lg shadow-primary/50 [background:color-mix(in_oklab,var(--color-accent)_30%,black)] ${
        className ?? ""
      }`}
    >
      <ReperePopover.Title>
        <span className="font-bold text-xl text-primary">{title}</span>
      </ReperePopover.Title>
      <ReperePopover.Content className="text-sm">
        {subtitle && <p className="text-base-content">{subtitle}</p>}
        {children && (
          <>
            <div className="divider divider-primary mt-2 mb-1" />
            {children}
          </>
        )}
      </ReperePopover.Content>
      <ReperePopover.Footer className="mt-3 flex gap-2">
        <button
          className="btn btn-ghost h-8 flex-1 text-primary hover:bg-primary/10 hover:text-primary disabled:text-primary/40"
          disabled={isDismissingAll}
          type="button"
          onClick={handleDismissAll}
        >
          {isDismissingAll ? "Dismissing..." : "Dismiss All"}
        </button>
        <ReperePopover.AcknowledgeButton
          className="btn btn-primary h-8 flex-1"
          type="button"
          onClick={handleAcknowledge}
        >
          Got it
        </ReperePopover.AcknowledgeButton>
      </ReperePopover.Footer>
    </ReperePopover>
  );
}

export { Popover };
