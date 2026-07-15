import { describe, it, expect } from "vitest";
import { chunk, MAX_FIRESTORE_BATCH_OPS } from "./batching.js";

describe("chunk", () => {
  it("splits into groups no larger than size", () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it("returns a single chunk when under the limit", () => {
    expect(chunk([1, 2, 3], 10)).toEqual([[1, 2, 3]]);
  });

  it("returns [] for empty input", () => {
    expect(chunk([], 500)).toEqual([]);
  });

  it("guards against non-positive or invalid sizes", () => {
    expect(chunk([1, 2], 0)).toEqual([]);
    expect(chunk([1, 2], -1)).toEqual([]);
    expect(chunk(null, 500)).toEqual([]);
  });

  it("keeps the Firestore write limit at 500", () => {
    expect(MAX_FIRESTORE_BATCH_OPS).toBe(500);
  });

  it("chunks 501 items into 500 + 1 (the case that used to fail a single batch)", () => {
    const items = Array.from({ length: 501 }, (_, i) => i);
    const groups = chunk(items, MAX_FIRESTORE_BATCH_OPS);
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(500);
    expect(groups[1]).toHaveLength(1);
  });
});
