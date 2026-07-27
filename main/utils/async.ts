function yieldToEventLoop(): Promise<void> {
  return new Promise((resolvePromise) => setImmediate(resolvePromise));
}

export { yieldToEventLoop };
