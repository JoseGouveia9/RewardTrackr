export async function sleepWithCountdown(milliseconds: number, onTick: (seconds: number) => void) {
  const end = Date.now() + milliseconds;
  while (true) {
    const remaining = end - Date.now();
    if (remaining <= 0) break;
    onTick(Math.ceil(remaining / 1000));
    await new Promise<void>((resolve) => setTimeout(resolve, Math.min(1000, remaining)));
  }
}
