import { describe, expect, it } from "vitest";

import {
  findDeathLines,
  findFocusEvents,
  findLatestFocusState,
  hashDeathLine,
  parseClientLogEvents,
} from "../ClientLog.matcher";

describe("ClientLog matcher", () => {
  it("matches common death lines", () => {
    expect(
      findDeathLines(
        [
          "2026/06/08 01:00:00 123 [INFO Client] You have died.",
          "unrelated line",
          "2026/06/08 01:00:10 123 [INFO Client] SomeCharacter has been slain.",
          "2026/06/08 01:00:11 123 [INFO Client] AccountName has been slain.",
          "2026/06/08 01:00:12 123 [INFO Client] <username> has been slain.",
        ].join("\n"),
      ),
    ).toEqual([
      "2026/06/08 01:00:10 123 [INFO Client] SomeCharacter has been slain.",
      "2026/06/08 01:00:11 123 [INFO Client] AccountName has been slain.",
      "2026/06/08 01:00:12 123 [INFO Client] <username> has been slain.",
    ]);
  });

  it("ignores death counter summaries from the /deaths command", () => {
    expect(
      findDeathLines(
        [
          "2026/06/25 19:43:45 116581671 3ef231e0 [INFO Client 49480] : You have died 50 times.",
          "2026/06/25 19:44:00 116597265 3ef231e0 [INFO Client 49480] : ailubleed has been slain.",
        ].join("\n"),
      ),
    ).toEqual([
      "2026/06/25 19:44:00 116597265 3ef231e0 [INFO Client 49480] : ailubleed has been slain.",
    ]);
  });

  it("ignores death text in global, party, and trade chat", () => {
    expect(
      findDeathLines(
        [
          "2026/06/13 01:05:07 137431000 3ef23347 [INFO Client 41260] #GlobalPlayer: Someone has been slain.",
          "2026/06/13 01:05:08 137431001 3ef23347 [INFO Client 41260] %PartyPlayer: you have died lol",
          "2026/06/13 01:05:09 137431002 3ef23347 [INFO Client 41260] $TradePlayer: AnotherPlayer was slain",
          "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
        ].join("\n"),
      ),
    ).toEqual([
      "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
    ]);
  });

  it("filters death lines to the configured character name", () => {
    const text = [
      "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
      "2026/06/13 01:05:14 137436344 3ef23347 [INFO Client 41260] : Teammate has been slain.",
      "2026/06/13 01:05:15 137436345 3ef23347 [INFO Client 41260] : AILUCANNON was slain.",
      "2026/06/13 01:05:16 137436346 3ef23347 [INFO Client 41260] : AILUCANNON has been slain by a monster.",
    ].join("\n");

    expect(findDeathLines(text, { characterName: "ailucannon" })).toEqual([
      "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
      "2026/06/13 01:05:15 137436345 3ef23347 [INFO Client 41260] : AILUCANNON was slain.",
    ]);
    expect(findDeathLines(text, { characterName: "OtherCharacter" })).toEqual(
      [],
    );
    expect(findDeathLines(text, { characterName: "" })).toHaveLength(4);
  });

  it("matches client window focus events", () => {
    const text = [
      "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
      "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus",
      "2026/05/26 02:21:57 124375844 54ee9e2f [INFO Client 49752] #Player: [WINDOW] Gained focus",
    ].join("\n");

    expect(findFocusEvents(text)).toEqual([
      {
        focused: true,
        line: "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
      },
      {
        focused: false,
        line: "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus",
      },
    ]);
    expect(findLatestFocusState(text)).toBe(false);
    expect(findLatestFocusState("unrelated")).toBeNull();
  });

  it("starts new client log sessions focused", () => {
    expect(
      findLatestFocusState(
        [
          "2026/06/26 20:04:31 204228109 528852ff [INFO Client 24172] [WINDOW] Gained focus",
          "2026/06/26 20:04:35 204232000 a1e41514 [INFO Client 24172] Closing game gracefully",
          "2026/06/26 20:05:41 ***** LOG FILE OPENING *****",
          "2026/06/26 20:05:41 204297796 84b56f77 [INFO Client 35236] [JOB] Start",
        ].join("\n"),
      ),
    ).toBe(true);

    expect(
      findLatestFocusState(
        [
          "2026/06/26 20:05:41 ***** LOG FILE OPENING *****",
          "2026/06/26 20:05:45 204302046 528852be [INFO Client 35236] [WINDOW] Lost focus",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  it("treats graceful game close as no longer focused", () => {
    expect(
      findLatestFocusState(
        [
          "2026/06/26 20:04:31 204228109 528852ff [INFO Client 24172] [WINDOW] Gained focus",
          "2026/06/26 20:04:35 204232000 a1e41514 [INFO Client 24172] Closing game gracefully",
        ].join("\n"),
      ),
    ).toBe(false);
  });

  it("parses client log session boundaries as focus events", () => {
    expect(
      parseClientLogEvents(
        [
          "2026/06/26 20:05:41 ***** LOG FILE OPENING *****",
          "2026/06/26 20:05:45 204302046 528852be [INFO Client 35236] [WINDOW] Lost focus",
          "2026/06/26 20:06:35 204232000 a1e41514 [INFO Client 35236] Closing game gracefully",
        ].join("\n"),
      ).focusEvents,
    ).toEqual([
      {
        focused: true,
        line: "2026/06/26 20:05:41 ***** LOG FILE OPENING *****",
      },
      {
        focused: false,
        line: "2026/06/26 20:05:45 204302046 528852be [INFO Client 35236] [WINDOW] Lost focus",
      },
      {
        focused: false,
        line: "2026/06/26 20:06:35 204232000 a1e41514 [INFO Client 35236] Closing game gracefully",
      },
    ]);
  });

  it("parses focus and death events from the same text pass", () => {
    expect(
      parseClientLogEvents(
        [
          "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
          "2026/06/13 01:05:07 137431000 3ef23347 [INFO Client 41260] #GlobalPlayer: Someone has been slain.",
          "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
          "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus",
        ].join("\n"),
      ),
    ).toEqual({
      activityEvents: [],
      deathLines: [
        "2026/06/13 01:05:13 137436343 3ef23347 [INFO Client 41260] : AILUCANNON has been slain.",
      ],
      focusEvents: [
        {
          focused: true,
          line: "2026/05/26 02:21:56 124375531 54eea165 [INFO Client 49752] [WINDOW] Gained focus",
        },
        {
          focused: false,
          line: "2026/05/26 02:21:56 124375843 54ee9e2f [INFO Client 49752] [WINDOW] Lost focus",
        },
      ],
    });
  });

  it("ignores non-location scene source flicker", () => {
    expect(
      parseClientLogEvents(
        [
          "2026/07/03 11:34:40 397038937 7fbd1225 [INFO Client 52640] [SCENE] Set Source [Interlude]",
          "2026/07/03 11:34:48 397047421 7fbd1225 [INFO Client 52640] [SCENE] Set Source [(null)]",
          "2026/07/03 11:34:50 397049859 7fbd1225 [INFO Client 52640] [SCENE] Set Source [The Khari Bazaar]",
        ].join("\n"),
      ).activityEvents,
    ).toEqual([
      expect.objectContaining({
        kind: "scene-source",
        sceneName: "The Khari Bazaar",
      }),
    ]);
  });

  it("hashes lines deterministically", () => {
    expect(hashDeathLine("You have died.")).toBe(
      hashDeathLine("You have died."),
    );
  });
});
