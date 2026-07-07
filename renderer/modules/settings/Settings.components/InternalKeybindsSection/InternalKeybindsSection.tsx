import { useSettingsShallow } from "~/renderer/store";

import {
  findInternalGlobalConflict,
  formatInternalAccelerator,
  internalKeybindConfigs,
  type KeybindSettingsValue,
} from "../KeybindsSettingsCard/KeybindsSettingsCard.utils";

function InternalKeybindsSection() {
  const settingsValue = useSettingsShallow(
    (settings) => settings.value,
  ) as KeybindSettingsValue | null;

  return (
    <section className="mt-6">
      <div className="mb-2 flex items-end justify-between gap-3">
        <div>
          <h3 className="m-0 font-semibold text-base-content/85 text-sm">
            Internal
          </h3>
          <p className="m-0 text-base-content/50 text-xs">
            App shortcuts that only run while Hinekora is focused.
          </p>
        </div>
      </div>

      <div className="divide-y divide-base-content/10 rounded-box border border-base-content/10">
        {internalKeybindConfigs.map((config) => {
          const conflict = findInternalGlobalConflict(
            config.accelerators,
            settingsValue,
          );

          return (
            <div
              className="grid gap-3 px-3 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,360px)] lg:items-center"
              key={config.id}
            >
              <div className="min-w-0">
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <span className="badge badge-ghost badge-sm shrink-0">
                    {config.scope}
                  </span>
                  <h4 className="m-0 min-w-0 font-medium text-base-content/80 text-sm">
                    {config.label}
                  </h4>
                </div>
                {conflict && (
                  <p className="m-0 mt-1 text-warning text-xs">
                    Also used by global {conflict.label}.
                  </p>
                )}
              </div>

              <div className="flex min-w-0 flex-wrap justify-start gap-2 lg:justify-end">
                {config.accelerators.map((accelerator) => (
                  <span
                    className="rounded border border-base-content/10 bg-base-200/70 px-2 py-1 font-semibold text-base-content/70 text-xs"
                    key={`${config.id}-${accelerator}`}
                  >
                    {formatInternalAccelerator(accelerator)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}

export { InternalKeybindsSection };
