import { useEffect, useRef } from "react";

import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";
import { useAppSetup } from "~/renderer/store";

import {
  AppSetupActions,
  AppSetupClientPathStep,
  AppSetupContainer,
  AppSetupErrorDisplay,
  AppSetupGameStep,
  AppSetupTelemetryStep,
} from "../AppSetup.components";

function AppSetupPage() {
  const { setupState, trackSetupStarted, validateCurrentStep, advanceStep } =
    useAppSetup();
  const hasAutoAdvanced = useRef(false);
  const currentStep = setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED;

  useEffect(() => {
    trackSetupStarted();
  }, [trackSetupStarted]);

  useEffect(() => {
    if (
      setupState &&
      setupState.currentStep === SETUP_STEPS.NOT_STARTED &&
      !hasAutoAdvanced.current
    ) {
      hasAutoAdvanced.current = true;
      void advanceStep();
    }
  }, [setupState, advanceStep]);

  useEffect(() => {
    if (currentStep > SETUP_STEPS.NOT_STARTED) {
      void validateCurrentStep();
    }
  }, [currentStep, validateCurrentStep]);

  if (!setupState || currentStep === SETUP_STEPS.NOT_STARTED) {
    return (
      <div className="flex h-full items-center justify-center bg-base-300">
        <span className="loading loading-spinner loading-lg text-primary" />
      </div>
    );
  }

  return (
    <AppSetupContainer>
      <AppSetupErrorDisplay />

      <div className="flex-1">
        {currentStep === SETUP_STEPS.SELECT_GAME && <AppSetupGameStep />}
        {currentStep === SETUP_STEPS.SELECT_CLIENT_PATH && (
          <AppSetupClientPathStep />
        )}
        {currentStep === SETUP_STEPS.TELEMETRY_CONSENT && (
          <AppSetupTelemetryStep />
        )}
      </div>

      <AppSetupActions />
    </AppSetupContainer>
  );
}

export default AppSetupPage;
