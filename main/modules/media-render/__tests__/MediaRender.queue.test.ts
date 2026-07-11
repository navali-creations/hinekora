import { describe, expect, it, vi } from "vitest";

import {
  MediaRenderQueue,
  MediaRenderQueueBusyError,
  MediaRenderQueueFullError,
} from "../MediaRender.queue";

function createDeferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((nextResolve) => {
    resolve = nextResolve;
  });
  return { promise, resolve };
}

describe("MediaRenderQueue", () => {
  it("runs one render at a time in request order", async () => {
    const queue = new MediaRenderQueue();
    const gate = createDeferred();
    const order: string[] = [];
    const first = queue.enqueue(async () => {
      order.push("first-start");
      await gate.promise;
      order.push("first-end");
      return "first";
    });
    const second = queue.enqueue(async () => {
      order.push("second");
      return "second";
    });

    await vi.waitFor(() => expect(order).toEqual(["first-start"]));
    gate.resolve();
    await expect(Promise.all([first, second])).resolves.toEqual([
      "first",
      "second",
    ]);
    expect(order).toEqual(["first-start", "first-end", "second"]);
  });

  it("continues after a failed render", async () => {
    const queue = new MediaRenderQueue();
    const failed = queue.enqueue(async () => {
      throw new Error("render failed");
    });
    const recovered = queue.enqueue(async () => "recovered");

    await expect(failed).rejects.toThrow("render failed");
    await expect(recovered).resolves.toBe("recovered");
  });

  it("runs queued high-priority work before normal work", async () => {
    const queue = new MediaRenderQueue();
    const gate = createDeferred();
    const order: string[] = [];
    const active = queue.enqueue(async () => {
      await gate.promise;
      order.push("active");
    });
    const normal = queue.enqueue(async () => {
      order.push("normal");
    });
    const high = queue.enqueue(
      async () => {
        order.push("high");
      },
      { priority: "high" },
    );

    gate.resolve();
    await Promise.all([active, normal, high]);
    expect(order).toEqual(["active", "high", "normal"]);
  });

  it("rejects opportunistic preview work while the renderer is busy", async () => {
    const queue = new MediaRenderQueue();
    const gate = createDeferred();
    const active = queue.enqueue(async () => gate.promise);

    await expect(
      queue.enqueue(async () => undefined, { rejectIfBusy: true }),
    ).rejects.toBeInstanceOf(MediaRenderQueueBusyError);

    gate.resolve();
    await active;
  });

  it("bounds pending work and supports cancelling queued jobs", async () => {
    const queue = new MediaRenderQueue(1);
    const gate = createDeferred();
    const active = queue.enqueue(async () => gate.promise);
    const abortController = new AbortController();
    const queued = queue.enqueue(async () => "queued", {
      signal: abortController.signal,
    });

    await expect(queue.enqueue(async () => undefined)).rejects.toBeInstanceOf(
      MediaRenderQueueFullError,
    );
    abortController.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    gate.resolve();
    await active;
  });

  it("rejects work whose signal was already aborted", async () => {
    const queue = new MediaRenderQueue();
    const abortController = new AbortController();
    abortController.abort();

    await expect(
      queue.enqueue(async () => undefined, {
        signal: abortController.signal,
      }),
    ).rejects.toMatchObject({ name: "AbortError" });
  });

  it("removes the abort listener before running signalled work", async () => {
    const queue = new MediaRenderQueue();
    const abortController = new AbortController();
    const removeEventListener = vi.spyOn(
      abortController.signal,
      "removeEventListener",
    );

    await expect(
      queue.enqueue(async () => "rendered", {
        priority: "high",
        signal: abortController.signal,
      }),
    ).resolves.toBe("rendered");
    expect(removeEventListener).toHaveBeenCalledWith(
      "abort",
      expect.any(Function),
    );
  });

  it("cancels queued high-priority work", async () => {
    const queue = new MediaRenderQueue();
    const gate = createDeferred();
    const active = queue.enqueue(async () => gate.promise);
    const abortController = new AbortController();
    const queued = queue.enqueue(async () => "queued", {
      priority: "high",
      signal: abortController.signal,
    });

    abortController.abort();
    await expect(queued).rejects.toMatchObject({ name: "AbortError" });
    gate.resolve();
    await active;
  });
});
