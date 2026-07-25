import {
  defaultEditorExportInventoryBatchSize,
  defaultEditorExportInventoryMaxEntries,
  defaultEditorExportInventoryMaxFiles,
  type EditorExportFile,
  type EditorExportInventoryResult,
  resolveEditorExportInventoryRoots,
  type ScanEditorExportFilesOptions,
  scanEditorExportFiles,
} from "./EditorExport.inventory";

const inventoryCacheMs = 5_000;

interface EditorExportInventoryCacheEntry {
  calculatedAtMs: number;
  fileBatches: EditorExportFile[][];
  result: EditorExportInventoryResult;
}

class EditorExportInventoryService {
  private static instance: EditorExportInventoryService | null = null;

  private readonly cache = new Map<string, EditorExportInventoryCacheEntry>();
  private generation = 0;
  private readonly requests = new Map<
    string,
    {
      generation: number;
      promise: Promise<EditorExportInventoryCacheEntry | null>;
    }
  >();

  static getInstance(): EditorExportInventoryService {
    if (!EditorExportInventoryService.instance) {
      EditorExportInventoryService.instance =
        new EditorExportInventoryService();
    }
    return EditorExportInventoryService.instance;
  }

  static resetForTests(): void {
    EditorExportInventoryService.instance = null;
  }

  invalidate(): void {
    this.generation += 1;
    this.cache.clear();
    this.requests.clear();
  }

  async scan(
    options: ScanEditorExportFilesOptions,
  ): Promise<EditorExportInventoryResult | null> {
    if (options.openDirectory || options.statFile) {
      return scanEditorExportFiles(options);
    }

    const key = createInventoryKey(options);
    const cached = this.cache.get(key);
    if (cached && Date.now() - cached.calculatedAtMs < inventoryCacheMs) {
      if (!(await replayInventoryFiles(cached.fileBatches, options))) {
        return null;
      }
      return cached.result;
    }

    const generation = this.generation;
    let request = this.requests.get(key);
    if (!request || request.generation !== generation) {
      const fileBatches: EditorExportFile[][] = [];
      const promise = scanEditorExportFiles({
        ...(options.batchSize === undefined
          ? {}
          : { batchSize: options.batchSize }),
        ...(options.maxEntries === undefined
          ? {}
          : { maxEntries: options.maxEntries }),
        ...(options.maxFiles === undefined
          ? {}
          : { maxFiles: options.maxFiles }),
        onFiles: (batch) => {
          fileBatches.push(batch);
        },
        roots: options.roots,
        shouldAbort: () =>
          generation !== this.generation || options.shouldAbort?.() === true,
      }).then((result) =>
        result
          ? {
              calculatedAtMs: Date.now(),
              fileBatches,
              result,
            }
          : null,
      );
      request = { generation, promise };
      this.requests.set(key, request);
    }

    let entry: EditorExportInventoryCacheEntry | null;
    try {
      entry = await request.promise;
    } finally {
      if (this.requests.get(key)?.promise === request.promise) {
        this.requests.delete(key);
      }
    }
    if (!entry || generation !== this.generation) {
      return null;
    }
    this.cache.set(key, entry);
    if (options.shouldAbort?.()) {
      return null;
    }
    if (!(await replayInventoryFiles(entry.fileBatches, options))) {
      return null;
    }
    return entry.result;
  }
}

function createInventoryKey(options: ScanEditorExportFilesOptions): string {
  return [
    ...resolveEditorExportInventoryRoots(options.roots),
    String(options.batchSize ?? defaultEditorExportInventoryBatchSize),
    String(options.maxEntries ?? defaultEditorExportInventoryMaxEntries),
    String(options.maxFiles ?? defaultEditorExportInventoryMaxFiles),
  ].join("\0");
}

async function replayInventoryFiles(
  batches: readonly EditorExportFile[][],
  options: ScanEditorExportFilesOptions,
): Promise<boolean> {
  for (const [index, batch] of batches.entries()) {
    if (options.shouldAbort?.()) {
      return false;
    }
    await options.onFiles(batch);
    if (index < batches.length - 1) {
      await new Promise<void>((resolvePromise) => setImmediate(resolvePromise));
    }
  }

  return options.shouldAbort?.() !== true;
}

export { EditorExportInventoryService };
