import { devtools } from "zustand/middleware";
import { immer } from "zustand/middleware/immer";
import type { StoreApi } from "zustand/vanilla";
import { createStore } from "zustand/vanilla";

import type {
  BoundStore,
  BoundStoreStateCreator,
} from "~/renderer/store/store.types";

type BoundStoreInitializer = (
  ...args: Parameters<BoundStoreStateCreator<BoundStore>>
) => Partial<BoundStore>;

function createBoundStoreForTests(
  initializer: BoundStoreInitializer,
): StoreApi<BoundStore> {
  return createStore<BoundStore>()(
    devtools(
      immer((...args) => initializer(...args) as BoundStore),
      { enabled: false },
    ),
  );
}

export { createBoundStoreForTests };
