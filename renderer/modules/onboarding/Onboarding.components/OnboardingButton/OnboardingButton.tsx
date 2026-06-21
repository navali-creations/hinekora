import { useState } from "react";
import { FaRedo } from "react-icons/fa";

import { useOnboardingActions } from "~/renderer/store";

import { useOnboardingMutationRefresh } from "../../Onboarding.hooks/useOnboardingMutationRefresh/useOnboardingMutationRefresh";

interface OnboardingButtonProps {
  size?: "sm" | "xs";
  className?: string;
}

function OnboardingButton({
  size = "sm",
  className = "",
}: OnboardingButtonProps) {
  const [isResetting, setIsResetting] = useState(false);
  const { resetAll } = useOnboardingActions();
  const runOnboardingMutation = useOnboardingMutationRefresh();

  const handleReset = async () => {
    setIsResetting(true);

    try {
      await runOnboardingMutation(() => resetAll());
    } catch (error) {
      console.error("Failed to reset onboarding:", error);
    } finally {
      setIsResetting(false);
    }
  };

  const sizeClassName = size === "xs" ? "btn-xs" : "btn-sm";

  return (
    <button
      className={`btn btn-primary ${sizeClassName} ${className}`}
      data-onboarding="onboarding-button"
      disabled={isResetting}
      type="button"
      onClick={handleReset}
    >
      <FaRedo className="h-4 w-4" />
      {isResetting ? "Resetting..." : "Reset Tour"}
    </button>
  );
}

export { OnboardingButton };
