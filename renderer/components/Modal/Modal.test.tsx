import { act, createRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { Modal, type ModalHandle } from "./Modal";

let container: HTMLDivElement;
let root: Root;

describe("Modal", () => {
  beforeEach(() => {
    container = document.createElement("div");
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    root.unmount();
    document.body.replaceChildren();
  });

  it("uses the requested surface background", async () => {
    const modalRef = createRef<ModalHandle>();

    await act(async () => {
      root.render(
        <Modal ref={modalRef} surface="base-100">
          Content
        </Modal>,
      );
    });

    const modalBox = document.body.querySelector(".modal-box");

    expect(modalBox?.classList.contains("bg-base-100")).toBe(true);
    expect(modalBox?.classList.contains("bg-base-300")).toBe(false);
  });
});
