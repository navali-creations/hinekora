import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";
import { useAppSetup } from "~/renderer/store";

function AppSetupActions() {
  const {
    setupState,
    validation,
    isLoading,
    advanceStep,
    goBack,
    completeSetup,
  } = useAppSetup();

  const currentStep = setupState?.currentStep ?? SETUP_STEPS.NOT_STARTED;
  const isFirstStep = currentStep === SETUP_STEPS.SELECT_GAME;
  const isLastStep = currentStep === SETUP_STEPS.TELEMETRY_CONSENT;
  const isNextDisabled =
    isLoading || (validation != null && !validation.isValid);
  const actionLabel = isLastStep ? "Finish" : "Next";

  const handleBack = () => {
    void goBack();
  };

  const handleNext = () => {
    void advanceStep();
  };

  const handleComplete = () => {
    void completeSetup();
  };

  return (
    <div className="flex items-center justify-end">
      <div className="flex gap-3">
        <button
          className={`btn btn-ghost ${isFirstStep ? "invisible" : ""}`}
          disabled={isLoading || isFirstStep}
          type="button"
          onClick={handleBack}
        >
          Back
        </button>
        <button
          className="btn btn-primary"
          disabled={isNextDisabled}
          type="button"
          onClick={isLastStep ? handleComplete : handleNext}
        >
          {actionLabel}
        </button>
      </div>
    </div>
  );
}

export default AppSetupActions;
