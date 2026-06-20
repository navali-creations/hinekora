import { gameOptions } from "~/renderer/modules/game/GameScope.constants";
import { GameSelectorTab } from "~/renderer/modules/game/GameSelectorTab/GameSelectorTab";

function GameSelector() {
  return (
    <div className="tabs" role="tablist" data-onboarding="game-selector">
      {gameOptions.map((game) => (
        <GameSelectorTab game={game.id} key={game.id} />
      ))}
    </div>
  );
}

export { GameSelector };
