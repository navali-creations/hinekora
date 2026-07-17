import { RepereTrigger } from "@repere/react";
import { TiInfoLargeOutline } from "react-icons/ti";

import { RepereButton } from "../RepereButton/RepereButton";

function OnboardingTrigger() {
  return (
    <RepereTrigger
      as={RepereButton}
      className="btn btn-circle btn-xs animate-pulse-ring border-2 border-primary bg-secondary text-primary shadow-lg shadow-primary/30 hover:bg-primary hover:text-primary-content"
      type="button"
    >
      <TiInfoLargeOutline size={18} />
    </RepereTrigger>
  );
}

export { OnboardingTrigger };
