import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { reconcileCacheVersions } from "./cache-versions";

vi.mock("@/i18n", () => ({ default: {} }));
vi.mock("@/features/minerwars/utils/comparison", () => ({ invalidateMinerWarsCache: vi.fn() }));

const CURRENT_VERSIONS = {
  rt_records_version: "4",
  rt_minerwars_version: "4",
};

function stubLocalStorage(initial: Record<string, string>) {
  const store = new Map(Object.entries(initial));
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => void store.set(key, value),
    removeItem: (key: string) => void store.delete(key),
  });
  return store;
}

describe("reconcileCacheVersions pricing migration", () => {
  const syncedUser = { rt_sync_alias: "alias", ...CURRENT_VERSIONS };

  beforeEach(() => vi.unstubAllGlobals());
  afterEach(() => vi.unstubAllGlobals());

  it("wipes the price cache and wallet sheets once when wallet pricing is on", () => {
    const store = stubLocalStorage({
      ...syncedUser,
      rt_pricecache: "{}",
      rt_reward_deposits: "{}",
      "rt_reward_solo-mining": "{}",
    });

    expect(reconcileCacheVersions(true)).toBe(true);
    expect(store.has("rt_pricecache")).toBe(false);
    expect(store.has("rt_reward_deposits")).toBe(false);
    expect(store.has("rt_reward_solo-mining")).toBe(true);
    expect(store.get("rt_pricing_version")).toBe("1");

    expect(reconcileCacheVersions(true)).toBe(false);
  });

  it("only drops the price cache when wallet pricing is off", () => {
    const store = stubLocalStorage({
      ...syncedUser,
      rt_pricecache: "{}",
      rt_reward_deposits: "{}",
    });

    expect(reconcileCacheVersions(false)).toBe(false);
    expect(store.has("rt_pricecache")).toBe(false);
    expect(store.has("rt_reward_deposits")).toBe(true);
  });

  it("leaves a fresh install untouched", () => {
    const store = stubLocalStorage({ rt_pricecache: "{}" });

    expect(reconcileCacheVersions(true)).toBe(false);
    expect(store.has("rt_pricecache")).toBe(true);
  });
});
