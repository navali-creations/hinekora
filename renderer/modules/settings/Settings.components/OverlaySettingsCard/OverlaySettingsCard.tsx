import { OverlayPreferenceToggleRow } from "../OverlayPreferenceToggleRow/OverlayPreferenceToggleRow";

function OverlaySettingsCard() {
  return (
    <section className="col-span-12 space-y-3">
      <p className="sr-only">Overlay settings</p>

      <div className="divide-y divide-base-content/10">
        <OverlayPreferenceToggleRow
          ariaLabel="Show recording overlay at startup"
          defaultValue={true}
          description="Show the recording overlay automatically when Hinekora starts. You can still show or hide it from the app bar overlay button."
          label="Recording Overlay Startup"
          preferenceKey="recorderOverlayShowOnStartup"
        />

        <OverlayPreferenceToggleRow
          ariaLabel="Start recording overlay minimized"
          defaultValue={false}
          description="Open the recording overlay in its compact controls-only mode when Hinekora starts."
          label="Start Recording Overlay Minimized"
          preferenceKey="recorderOverlayStartMinimized"
        />

        <OverlayPreferenceToggleRow
          ariaLabel="Include overlays in captures"
          defaultValue={false}
          description="Keep all Hinekora overlays visible in Windows screenshots, Hinekora rewinds and recordings, and other capture tools."
          label="Include Overlays in Captures"
          preferenceKey="overlayWindowsIncludeInCaptures"
        />
      </div>

      <div className="border-base-content/10 border-t pt-4">
        <h3 className="font-semibold text-sm">
          Keep overlays visible while a game is running
        </h3>
        <p className="mt-1 mb-0 text-base-content/60 text-sm">
          Selected overlays ignore game focus while Path of Exile or Path of
          Exile 2 is running. Manually hidden overlays stay hidden.
        </p>
        <p className="mt-1 mb-0 text-base-content/60 text-sm">
          These settings work best with two or more monitors.
        </p>

        <div className="mt-3 divide-y divide-base-content/10 rounded-md border border-base-content/8 bg-base-300/35 px-3">
          <OverlayPreferenceToggleRow
            activeStatusLabel="Always visible"
            ariaLabel="Keep recording controls visible while a game is running"
            defaultValue={false}
            inactiveStatusLabel="Hidden when game is not focused"
            label="Recording controls"
            preferenceKey="recorderOverlayIgnoreGameFocus"
          />

          <OverlayPreferenceToggleRow
            activeStatusLabel="Always visible"
            ariaLabel="Keep aura overlay visible while a game is running"
            defaultValue={false}
            inactiveStatusLabel="Hidden when game is not focused"
            label="Aura overlay"
            preferenceKey="auraOverlayIgnoreGameFocus"
          />

          <OverlayPreferenceToggleRow
            activeStatusLabel="Always visible"
            ariaLabel="Keep clip previews visible while a game is running"
            defaultValue={false}
            inactiveStatusLabel="Hidden when game is not focused"
            label="Clip previews"
            preferenceKey="clipPreviewOverlayIgnoreGameFocus"
          />

          <OverlayPreferenceToggleRow
            activeStatusLabel="Always visible"
            ariaLabel="Keep grid lines overlay visible while a game is running"
            defaultValue={false}
            inactiveStatusLabel="Hidden when game is not focused"
            label="Grid lines overlay"
            preferenceKey="gridLinesOverlayIgnoreGameFocus"
          />
        </div>
      </div>
    </section>
  );
}

export { OverlaySettingsCard };
