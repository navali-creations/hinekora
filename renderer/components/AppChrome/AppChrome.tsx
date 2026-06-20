import type { PropsWithChildren } from "react";

import { AppMenu } from "~/renderer/modules/app-menu";
import { Sidebar } from "~/renderer/modules/sidebar/Sidebar/Sidebar";

function AppChrome({ children }: PropsWithChildren) {
  return (
    <div
      className="grid h-screen min-w-[1200px] grid-rows-[40px_minmax(0,1fr)] overflow-hidden bg-base-100 text-base-content"
      data-theme="hinekora"
    >
      <AppMenu />
      <div className="grid min-h-0 grid-cols-[160px_minmax(0,1fr)] overflow-hidden">
        <Sidebar />
        <main className="relative z-0 flex h-full min-h-0 flex-col overflow-hidden overscroll-contain">
          {children}
        </main>
      </div>
    </div>
  );
}

export { AppChrome };
