import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SETUP_STEPS } from "~/main/modules/app-setup/AppSetup.types";

const storeMocks = vi.hoisted(() => ({
  useAppSetup: vi.fn(),
}));

vi.mock("~/renderer/store", () => ({
  useAppSetup: storeMocks.useAppSetup,
}));

import AppSetupActions from "./AppSetupActions";

describe("AppSetupActions", () => {
  beforeEach(() => {
    storeMocks.useAppSetup.mockReturnValue({
      setupState: {
        currentStep: SETUP_STEPS.SELECT_GAME,
      },
      validation: { isValid: true, errors: [] },
      isLoading: true,
      advanceStep: vi.fn(),
      goBack: vi.fn(),
      completeSetup: vi.fn(),
    });
  });

  it("keeps the action label stable while step navigation is loading", () => {
    const html = renderToStaticMarkup(<AppSetupActions />);

    expect(html).toContain("Next");
    expect(html).not.toContain("Loading");
    expect(html).not.toContain("loading-spinner");
  });
});
