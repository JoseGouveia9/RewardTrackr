const COUNTER_TTL_SECONDS = 86400;

export function utcDay() {
  return new Date().toISOString().slice(0, 10);
}

export async function readCount(kv, key) {
  const raw = await kv.get(key);
  return raw ? parseInt(raw, 10) : 0;
}

async function writeCount(kv, key, count) {
  if (count <= 0) await kv.delete(key);
  else await kv.put(key, String(count), { expirationTtl: COUNTER_TTL_SECONDS });
}

export async function decrementCount(kv, key) {
  await writeCount(kv, key, (await readCount(kv, key)) - 1);
}
