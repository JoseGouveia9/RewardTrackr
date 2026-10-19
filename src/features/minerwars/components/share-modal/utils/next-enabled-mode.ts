/** Returns the next enabled mode after `current`, wrapping around; falls back to the first mode. */
export function nextEnabledMode<T extends string>(
  order: readonly T[],
  current: T,
  isEnabled: (mode: T) => boolean,
): T {
  let index = order.indexOf(current);
  for (let step = 0; step < order.length; step += 1) {
    index = (index + 1) % order.length;
    if (isEnabled(order[index]!)) return order[index]!;
  }
  return order[0]!;
}
