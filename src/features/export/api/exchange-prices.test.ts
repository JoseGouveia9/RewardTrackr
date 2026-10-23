import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchExchangePrice, pickCandlePrice, type Candle } from "./exchange-prices";

const HOUR = 3_600_000;
const base = Date.UTC(2025, 9, 8, 9, 0, 0);

function hourly(offsetHours: number, open: number, close: number): Candle {
  return {
    openMilliseconds: base + offsetHours * HOUR,
    durationMilliseconds: HOUR,
    open,
    close,
  };
}

describe("pickCandlePrice", () => {
  it("returns null without candles", () => {
    expect(pickCandlePrice([], base)).toBeNull();
  });

  it("uses the open of the containing candle when the target is in its first half", () => {
    const result = pickCandlePrice([hourly(-1, 1, 2), hourly(0, 3, 4)], base + 10 * 60_000);
    expect(result).toEqual({ price: 3, priceTimestamp: new Date(base).toISOString() });
  });

  it("uses the close of the containing candle when the target is in its second half", () => {
    const result = pickCandlePrice([hourly(0, 3, 4)], base + 50 * 60_000);
    expect(result).toEqual({ price: 4, priceTimestamp: new Date(base + HOUR).toISOString() });
  });

  it("falls back to the nearest candle when none contains the target", () => {
    const result = pickCandlePrice([hourly(0, 3, 4), hourly(5, 7, 8)], base + 4 * HOUR);
    expect(result?.price).toBe(7);
  });
});

describe("fetchExchangePrice coverage", () => {
  afterEach(() => vi.unstubAllGlobals());

  function stubEmptyFetch() {
    const fetchMock = vi.fn(async () => new Response("[]", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    return fetchMock;
  }

  const requestedUrls = (fetchMock: ReturnType<typeof stubEmptyFetch>) =>
    fetchMock.mock.calls.map((call) => String((call as unknown[])[0]));

  it("makes no request for TON before any exchange listed it", async () => {
    const fetchMock = stubEmptyFetch();
    expect(await fetchExchangePrice("the-open-network", "2023-01-01T10:00:00Z")).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("skips Binance for TON after its delisting", async () => {
    const fetchMock = stubEmptyFetch();
    await fetchExchangePrice("the-open-network", "2026-09-25T13:27:05Z");
    expect(requestedUrls(fetchMock).every((url) => url.includes("api.exchange.coinbase.com"))).toBe(
      true,
    );
  });

  it("only asks MEXC for GoMining before Bitget and Gate have data", async () => {
    const fetchMock = stubEmptyFetch();
    await fetchExchangePrice("gmt-token", "2022-01-01T10:00:00Z");
    const urls = requestedUrls(fetchMock);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("api.mexc.com");
  });

  it("never asks Binance or Coinbase for GoMining", async () => {
    const fetchMock = stubEmptyFetch();
    await fetchExchangePrice("gmt-token", "2025-10-08T09:30:23Z");
    const urls = requestedUrls(fetchMock);
    expect(urls.some((url) => url.includes("binance") || url.includes("coinbase"))).toBe(false);
  });

  it("uses only Gate's 4h candles for timestamps past its 1h window", async () => {
    const fetchMock = stubEmptyFetch();
    await fetchExchangePrice("bitcoin", "2023-01-01T10:00:00Z");
    const gateUrls = requestedUrls(fetchMock).filter((url) => url.includes("gateio.ws"));
    expect(gateUrls).toHaveLength(1);
    expect(gateUrls[0]).toContain("interval=4h");
  });
});
