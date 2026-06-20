import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";

const steps = [
  { step: SETUP_STEPS.SELECT_GAME, label: "Select Game" },
  { step: SETUP_STEPS.SELECT_CLIENT_PATH, label: "Client.txt Path" },
  { step: SETUP_STEPS.TELEMETRY_CONSENT, label: "Privacy & Telemetry" },
];

interface AppSetupProgressBarProps {
  currentStep: number;
}

function AppSetupProgressBar({ currentStep }: AppSetupProgressBarProps) {
  return (
    <div className="flex flex-col gap-0">
      {steps.map(({ step, label }, index) => {
        const isActive = currentStep === step;
        const isCompleted = currentStep > step;
        const isLast = index === steps.length - 1;

        return (
          <div className="flex items-stretch" key={step}>
            <div className="flex flex-col items-center">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold transition-colors ${
                  isActive
                    ? "bg-primary text-primary-content ring-2 ring-primary ring-offset-2 ring-offset-base-200"
                    : isCompleted
                      ? "bg-primary text-primary-content"
                      : "border border-primary/30 bg-primary/20 text-base-content/70"
                }`}
              >
                {isCompleted ? (
                  <svg
                    className="h-4 w-4"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={3}
                    viewBox="0 0 24 24"
                  >
                    <path
                      d="M5 13l4 4L19 7"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                ) : (
                  step
                )}
              </div>
              {!isLast && (
                <div
                  className={`min-h-6 w-0.5 flex-1 transition-colors ${
                    isCompleted ? "bg-primary" : "bg-primary/20"
                  }`}
                />
              )}
            </div>
            <div className="ml-3 pb-6">
              <span
                className={`text-sm font-medium transition-colors ${
                  isActive
                    ? "text-primary"
                    : isCompleted
                      ? "text-base-content"
                      : "text-base-content/50"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default AppSetupProgressBar;
