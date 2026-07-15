import { describe, it, expect } from "vitest";
import { orphanMetaKeys } from "./localCompositeStore.js";

describe("orphanMetaKeys (#16)", () => {
  it("returns bm_meta keys whose bookmark id is no longer valid", () => {
    const keys = ["bm_meta:1", "bm_meta:2", "bm_meta:3"];
    const valid = new Set(["2"]);
    expect(orphanMetaKeys(keys, valid)).toEqual(["bm_meta:1", "bm_meta:3"]);
  });

  it("ignores non-metadata keys", () => {
    const keys = ["bm_current_theme", "bm_themes", "bm_meta:1"];
    expect(orphanMetaKeys(keys, new Set())).toEqual(["bm_meta:1"]);
  });

  it("returns [] when every id is still valid", () => {
    const keys = ["bm_meta:1", "bm_meta:2"];
    expect(orphanMetaKeys(keys, new Set(["1", "2"]))).toEqual([]);
  });

  it("tolerates null/empty keys", () => {
    expect(orphanMetaKeys([null, undefined, ""], new Set())).toEqual([]);
    expect(orphanMetaKeys(null, new Set())).toEqual([]);
  });
});
