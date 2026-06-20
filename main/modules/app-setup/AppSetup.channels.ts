enum AppSetupChannel {
  GetSetupState = "app-setup:get-state",
  IsSetupComplete = "app-setup:is-complete",
  AdvanceStep = "app-setup:advance-step",
  GoToStep = "app-setup:go-to-step",
  ValidateCurrentStep = "app-setup:validate-current-step",
  CompleteSetup = "app-setup:complete",
  ResetSetup = "app-setup:reset",
  SkipSetup = "app-setup:skip",
}

export { AppSetupChannel };
