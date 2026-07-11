import { describe, expect, it, vi } from "vitest";

import { ReplayClipOperationCoordinator } from "../ReplayClips.operations";
import { createDeferred } from "./ReplayClips.service.test-harness";

describe("ReplayClipOperationCoordinator", () => {
  it("continues clip and stored-file queues after failures", async () => {
    const coordinator = new ReplayClipOperationCoordinator();
    const clipFailure = coordinator.queueClipOperation("clip-1", async () => {
      throw new Error("clip failed");
    });
    const clipSuccess = coordinator.queueClipOperation(
      "clip-1",
      async () => "clip recovered",
    );
    const mutationFailure = coordinator.queueStoredFileMutation(async () => {
      throw new Error("mutation failed");
    });
    const mutationSuccess = coordinator.queueStoredFileMutation(
      async () => "mutation recovered",
    );

    await expect(clipFailure).rejects.toThrow("clip failed");
    await expect(clipSuccess).resolves.toBe("clip recovered");
    await expect(mutationFailure).rejects.toThrow("mutation failed");
    await expect(mutationSuccess).resolves.toBe("mutation recovered");
  });

  it("locks multi-clip operations in deterministic order", async () => {
    const coordinator = new ReplayClipOperationCoordinator();
    const firstClip = createDeferred();
    const order: string[] = [];
    const single = coordinator.queueClipOperation("clip-1", async () => {
      order.push("single-start");
      await firstClip.promise;
      order.push("single-end");
    });
    const batch = coordinator.queueClipOperations(
      ["clip-2", "clip-1", "clip-2"],
      async () => {
        order.push("batch");
      },
    );

    await vi.waitFor(() => expect(order).toEqual(["single-start"]));
    firstClip.resolve();
    await Promise.all([single, batch]);
    expect(order).toEqual(["single-start", "single-end", "batch"]);
  });

  it("returns the original promise for a repeated request key", async () => {
    const coordinator = new ReplayClipOperationCoordinator();
    const operation = vi.fn(async () => ({ ok: true }));

    const first = coordinator.runIdempotent(
      "update:clip-1:request-1",
      operation,
    );
    const repeated = coordinator.runIdempotent(
      "update:clip-1:request-1",
      operation,
    );

    expect(repeated).toBe(first);
    await expect(repeated).resolves.toEqual({ ok: true });
    expect(operation).toHaveBeenCalledTimes(1);
  });

  it("runs unkeyed work directly and bounds completed request history", async () => {
    const coordinator = new ReplayClipOperationCoordinator();
    const operation = vi.fn(async () => "done");

    await expect(coordinator.runIdempotent(null, operation)).resolves.toBe(
      "done",
    );
    await expect(
      coordinator.queueClipOperations([], async () => "no clips"),
    ).resolves.toBe("no clips");
    for (let index = 0; index < 257; index += 1) {
      await coordinator.runIdempotent(`request-${index}`, operation);
    }
    await coordinator.runIdempotent("request-0", operation);

    expect(operation).toHaveBeenCalledTimes(259);
  });

  it("evicts settled requests after an older request that is still active", async () => {
    const coordinator = new ReplayClipOperationCoordinator();
    const activeRequest = createDeferred();
    const first = coordinator.runIdempotent("active", async () => {
      await activeRequest.promise;
      return "active done";
    });

    for (let index = 0; index < 256; index += 1) {
      await coordinator.runIdempotent(`settled-${index}`, async () => "done");
    }

    activeRequest.resolve();
    await expect(first).resolves.toBe("active done");
  });
});
