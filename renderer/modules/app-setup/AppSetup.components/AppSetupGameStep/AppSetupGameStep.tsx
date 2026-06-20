import clsx from "clsx";
import type { MouseEvent } from "react";

import { useAppSetup } from "~/renderer/store";

import type { GameId } from "~/types";

const games: Array<{ value: GameId; label: string; description: string }> = [
  {
    value: "poe1",
    label: "Path of Exile 1",
    description: "The original Path of Exile client.",
  },
  {
    value: "poe2",
    label: "Path of Exile 2",
    description: "The standalone sequel client.",
  },
];

function AppSetupGameStep() {
  const { setupState, toggleGame } = useAppSetup();
  const selectedGames = setupState?.selectedGames ?? [];

  const handleToggle = (game: GameId) => {
    void toggleGame(game);
  };

  const handleGameClick = (event: MouseEvent<HTMLButtonElement>) => {
    const game = event.currentTarget.dataset.game as GameId | undefined;

    if (game) {
      handleToggle(game);
    }
  };

  return (
    <div>
      <h2 className="mb-1 text-xl font-semibold text-base-content">
        Which games do you play?
      </h2>
      <p className="mb-4 text-sm text-base-content/60">
        Select one or both games. You can change this later in settings.
      </p>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {games.map((game) => {
          const selected = selectedGames.includes(game.value);
          const isOnlySelected = selected && selectedGames.length === 1;

          return (
            <button
              className={clsx(
                "relative block min-h-[78px] w-full rounded-lg border-2 p-4 text-left text-base-content transition-all disabled:cursor-not-allowed disabled:opacity-100",
                selected
                  ? "border-primary bg-primary/10"
                  : "border-base-100 bg-transparent hover:border-base-content/30",
                isOnlySelected ? "cursor-not-allowed" : "cursor-pointer",
              )}
              disabled={isOnlySelected}
              data-game={game.value}
              key={game.value}
              title={
                isOnlySelected
                  ? "At least one game must be selected"
                  : undefined
              }
              type="button"
              onClick={handleGameClick}
            >
              <div
                className={clsx(
                  "absolute top-3 right-3 flex h-5 w-5 items-center justify-center rounded border-2 transition-colors",
                  selected
                    ? "border-primary bg-primary"
                    : "border-base-content/30 bg-base-100",
                )}
              >
                {selected && (
                  <svg
                    className="h-3 w-3 text-primary-content"
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
                )}
              </div>
              <div className="pr-6 font-semibold text-base-content">
                {game.label}
              </div>
              <div className="mt-0.5 text-xs text-base-content/60">
                {game.description}
              </div>
            </button>
          );
        })}
      </div>

      {selectedGames.length === 2 && (
        <p className="mt-3 text-xs text-base-content/50">
          <span className="font-medium text-base-content/70">
            Playing both?
          </span>{" "}
          You will configure Client.txt paths for each game.
        </p>
      )}
    </div>
  );
}

export default AppSetupGameStep;
