import { ipcRenderer } from "electron";

import type { AppSetupStep } from "~/types";
import { AppSetupChannel } from "./AppSetup.channels";
import type {
  AppSetupResult,
  SetupState,
  StepValidationResult,
} from "./AppSetup.types";

const AppSetupAPI = {
  getSetupState: (): Promise<SetupState> =>
    ipcRenderer.invoke(AppSetupChannel.GetSetupState),
  isSetupComplete: (): Promise<boolean> =>
    ipcRenderer.invoke(AppSetupChannel.IsSetupComplete),
  advanceStep: (): Promise<AppSetupResult> =>
    ipcRenderer.invoke(AppSetupChannel.AdvanceStep),
  goToStep: (step: AppSetupStep): Promise<AppSetupResult> =>
    ipcRenderer.invoke(AppSetupChannel.GoToStep, step),
  validateCurrentStep: (): Promise<StepValidationResult> =>
    ipcRenderer.invoke(AppSetupChannel.ValidateCurrentStep),
  completeSetup: (): Promise<AppSetupResult> =>
    ipcRenderer.invoke(AppSetupChannel.CompleteSetup),
  resetSetup: (): Promise<void> =>
    ipcRenderer.invoke(AppSetupChannel.ResetSetup),
  skipSetup: (): Promise<void> => ipcRenderer.invoke(AppSetupChannel.SkipSetup),
};

export { AppSetupAPI };
