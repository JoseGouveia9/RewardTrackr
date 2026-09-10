// Runs `fn` over `items` with at most `concurrency` calls in flight at once, preserving
// result order. Used anywhere a batch of independent network calls would otherwise be
// awaited one-by-one in a for loop (which pays full network latency per item instead of
// overlapping it).
export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    while (true) {
      const i = next++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}
