import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

import { AppSetupPage } from "~/renderer/modules/app-setup";
import { useAppSetup } from "~/renderer/store";

function SetupRoute() {
  const navigate = useNavigate();
  const { setupState } = useAppSetup();
  const isComplete = setupState?.isComplete ?? false;

  useEffect(() => {
    if (isComplete) {
      void navigate({ to: "/" });
    }
  }, [isComplete, navigate]);

  return <AppSetupPage />;
}

export const Route = createFileRoute("/setup")({
  component: SetupRoute,
});
