import type { ReactNode } from "react";

import { useAppSetup } from "~/renderer/store";

import AppSetupProgressBar from "../AppSetupProgressBar/AppSetupProgressBar";

interface AppSetupContainerProps {
  children: ReactNode;
}

function AppSetupContainer({ children }: AppSetupContainerProps) {
  const { setupState } = useAppSetup();
  const currentStep = setupState?.currentStep ?? 1;

  return (
    <div className="flex h-full items-center justify-center bg-base-300 p-6">
      <div className="flex w-full max-w-4xl overflow-hidden rounded-lg border border-base-100 bg-base-200 shadow-2xl">
        <div className="flex w-48 flex-col border-r border-base-content/10 bg-base-100/50 p-6">
          <h2 className="mb-6 text-lg font-bold text-base-content">Setup</h2>
          <AppSetupProgressBar currentStep={currentStep} />
        </div>
        <div className="flex min-h-[500px] flex-1 flex-col p-6">{children}</div>
      </div>
    </div>
  );
}

export default AppSetupContainer;
