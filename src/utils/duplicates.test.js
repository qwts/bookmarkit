import { describe, it, expect } from "vitest";
import { getDuplicateKey, findDuplicateIds, filterDuplicateImports } from "./duplicates.js";

describe("getDuplicateKey", () => {
  it("is case-insensitive and trims title + url", () => {
    expect(getDuplicateKey({ title: "  Hello ", url: "HTTP://X.COM " })).toBe(
      getDuplicateKey({ title: "hello", url: "http://x.com" })
    );
  });

  it("tolerates missing fields", () => {
    expect(getDuplicateKey({})).toBe("|");
  });
});

describe("findDuplicateIds", () => {
  it("keeps the first occurrence and returns later duplicate ids", () => {
    const list = [
      { id: "1", title: "A", url: "http://a.com" },
      { id: "2", title: "a", url: "http://a.com" },
      { id: "3", title: "B", url: "http://b.com" },
      { id: "4", title: "b ", url: " http://b.com" },
    ];
    expect(findDuplicateIds(list)).toEqual(["2", "4"]);
  });

  it("returns an empty array when there are no duplicates", () => {
    expect(findDuplicateIds([{ id: "1", title: "A", url: "http://a.com" }])).toEqual([]);
  });
});

describe("filterDuplicateImports", () => {
  it("skips imports already present in existing bookmarks", () => {
    const existing = [{ id: "1", title: "A", url: "http://a.com" }];
    const incoming = [
      { title: "a", url: "http://a.com" },
      { title: "C", url: "http://c.com" },
    ];
    const { bookmarks, skippedCount } = filterDuplicateImports(incoming, existing);
    expect(skippedCount).toBe(1);
    expect(bookmarks).toEqual([{ title: "C", url: "http://c.com" }]);
  });

  it("dedupes within the incoming batch too", () => {
    const incoming = [
      { title: "C", url: "http://c.com" },
      { title: "c", url: "http://c.com" },
    ];
    const { bookmarks, skippedCount } = filterDuplicateImports(incoming, []);
    expect(bookmarks).toHaveLength(1);
    expect(skippedCount).toBe(1);
  });

  it("defaults to empty inputs", () => {
    expect(filterDuplicateImports()).toEqual({ bookmarks: [], skippedCount: 0 });
  });
});
