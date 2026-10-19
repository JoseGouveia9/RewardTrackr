import { describe, expect, it } from "vitest";
import { buildOccurrenceIds } from "./row-ids";
import { parseJsonSafe } from "./parse-json-safe";

describe("buildOccurrenceIds", () => {
  it("numbers repeated createdAt values so ids stay stable across re-sorts", () => {
    const ids = buildOccurrenceIds(
      [{ createdAt: "a" }, { createdAt: "a" }, { createdAt: "b" }],
      "k",
    );
    expect(ids).toEqual(["k::a::0", "k::a::1", "k::b::0"]);
  });

  it("separates sheets by key", () => {
    expect(buildOccurrenceIds([{ createdAt: "a" }], "x")).not.toEqual(
      buildOccurrenceIds([{ createdAt: "a" }], "y"),
    );
  });
});

describe("parseJsonSafe", () => {
  it("parses valid JSON", () => {
    expect(parseJsonSafe('{"a":1}', {})).toEqual({ a: 1 });
  });

  it("falls back on null, empty and invalid input", () => {
    expect(parseJsonSafe(null, 7)).toBe(7);
    expect(parseJsonSafe("", 7)).toBe(7);
    expect(parseJsonSafe("{oops", 7)).toBe(7);
  });
});
