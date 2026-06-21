import {
  createRootRoute,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";

import { AppChrome } from "~/renderer/components/AppChrome/AppChrome";
import AppSetupAppBar from "~/renderer/modules/app-setup/AppSetup.components/AppSetupAppBar/AppSetupAppBar";
import { BeaconHost } from "~/renderer/modules/onboarding";
import { useAppMenu, useAppSetup, useRootActions } from "~/renderer/store";
import "@repere/react/styles.css";

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });
  const [isHydrating, setIsHydrating] = useState(true);
  const [isSlow, setIsSlow] = useState(false);
  const slowTimerRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const { hydrate, startListeners } = useRootActions();
  const { isWhatsNewOpen } = useAppMenu();
  const { isSetupComplete, setupState } = useAppSetup();
  const isSetupMode = !setupState?.isComplete;

  useEffect(() => {
    slowTimerRef.current = setTimeout(() => setIsSlow(true), 5_000);

    const initialize = async () => {
      try {
        await hydrate();

        if (!isSetupComplete()) {
          await navigate({ to: "/setup" });
        }
      } catch (error) {
        console.error("Failed to initialize app:", error);
      } finally {
        clearTimeout(slowTimerRef.current);
        setIsHydrating(false);
      }
    };

    void initialize();

    return startListeners();
  }, [hydrate, startListeners, navigate, isSetupComplete]);

  useEffect(() => {
    if (isHydrating || setupState?.isComplete || pathname === "/setup") {
      return;
    }

    void navigate({ to: "/setup", replace: true });
  }, [isHydrating, setupState?.isComplete, pathname, navigate]);

  if (isHydrating) {
    return (
      <div
        className="flex h-screen items-center justify-center bg-base-300"
        data-theme="hinekora"
      >
        <div className="text-center">
          <div className="loading loading-spinner loading-lg text-primary" />
          <p className="mt-4 text-sm text-base-content/70">
            Loading Hinekora...
          </p>
          {isSlow && (
            <p className="mt-2 text-xs text-base-content/50">
              This is taking longer than usual.
            </p>
          )}
        </div>
      </div>
    );
  }

  if (isSetupMode) {
    return (
      <div
        className="flex h-screen flex-col overflow-hidden"
        data-theme="hinekora"
      >
        <AppSetupAppBar />
        <div className="flex flex-1 overflow-hidden">
          <main className="relative z-0 flex-1 overflow-auto">
            <Outlet />
          </main>
        </div>
      </div>
    );
  }

  return (
    <>
      <AppChrome>
        <Outlet />
      </AppChrome>
      <BeaconHost enabled={!isHydrating && !isWhatsNewOpen} />
    </>
  );
}

export const Route = createRootRoute({ component: RootLayout });
