import { Outlet, useRouterState } from "@tanstack/react-router";

import { ClipsLibraryPage } from "./ClipsLibraryPage/ClipsLibraryPage";

function ClipsPage() {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  });

  if (pathname !== "/clips") {
    return <Outlet />;
  }

  return <ClipsLibraryPage />;
}

export { ClipsPage };
