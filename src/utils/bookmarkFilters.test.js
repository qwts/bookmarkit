import { describe, it, expect } from "vitest";
import { sortStepsByPriority, mergeAgentPlan, applyAgentPlan } from "./bookmarkFilters.js";

describe("sortStepsByPriority (#21)", () => {
  it("orders by numeric priority, lowest first", () => {
    const steps = [
      { action: "sortBookmarks", priority: 2 },
      { action: "searchBookmarks", priority: 1 },
    ];
    expect(sortStepsByPriority(steps).map((s) => s.action)).toEqual([
      "searchBookmarks",
      "sortBookmarks",
    ]);
  });

  it("is stable for equal priorities (keeps original order)", () => {
    const steps = [
      { action: "a", priority: 1 },
      { action: "b", priority: 1 },
    ];
    expect(sortStepsByPriority(steps).map((s) => s.action)).toEqual(["a", "b"]);
  });

  it("returns input order when no step has a priority", () => {
    const steps = [{ action: "b" }, { action: "a" }];
    expect(sortStepsByPriority(steps).map((s) => s.action)).toEqual(["b", "a"]);
  });
});

describe("mergeAgentPlan (#20)", () => {
  it("replaces a prior step of the same action instead of stacking", () => {
    const previous = [{ action: "searchBookmarks", parameters: { searchTerm: "react" } }];
    const steps = [{ action: "searchBookmarks", parameters: { searchTerm: "vue" } }];
    expect(mergeAgentPlan(previous, steps)).toEqual([
      { action: "searchBookmarks", parameters: { searchTerm: "vue" } },
    ]);
  });

  it("keeps prior steps of a different action (refinement)", () => {
    const previous = [{ action: "searchBookmarks", parameters: { searchTerm: "react" } }];
    const steps = [{ action: "sortBookmarks", parameters: { sortBy: "rating" } }];
    expect(mergeAgentPlan(previous, steps)).toEqual([...previous, ...steps]);
  });

  it("replaces a step in its original slot, not at the end (#32 ordering)", () => {
    const previous = [
      { action: "searchBookmarks", parameters: { searchTerm: "react" } },
      { action: "sortBookmarks", parameters: { sortBy: "rating" } },
    ];
    const steps = [{ action: "searchBookmarks", parameters: { searchTerm: "vue" } }];
    expect(mergeAgentPlan(previous, steps).map((s) => s.action)).toEqual([
      "searchBookmarks", // stays in slot 0, before the sort
      "sortBookmarks",
    ]);
  });

  it("clears the accumulated plan on reset/showAll", () => {
    const previous = [{ action: "searchBookmarks" }, { action: "sortBookmarks" }];
    expect(mergeAgentPlan(previous, [{ action: "resetSearch" }])).toEqual([
      { action: "resetSearch" },
    ]);
  });

  it("stays bounded to one step per action across repeated same-type queries", () => {
    let plan = [];
    for (const term of ["a", "b", "c", "d"]) {
      plan = mergeAgentPlan(plan, [{ action: "searchBookmarks", parameters: { searchTerm: term } }]);
    }
    expect(plan).toHaveLength(1);
    expect(plan[0].parameters.searchTerm).toBe("d");
  });

  it("normalizes a non-array previous plan", () => {
    const previous = { action: "searchBookmarks", parameters: { searchTerm: "old" } };
    const steps = [{ action: "sortBookmarks" }];
    expect(mergeAgentPlan(previous, steps)).toEqual([previous, ...steps]);
  });
});

describe("applyAgentPlan honors priority (#21)", () => {
  const list = [
    { id: "1", title: "Banana", rating: 5 },
    { id: "2", title: "apple", rating: 1 },
    { id: "3", title: "Cherry", rating: 3 },
  ];

  it("applies a lower-priority sort before a higher-priority limit regardless of array order", () => {
    // limit appears first in the array but has the higher priority number,
    // so the sort (priority 1) must run before the limit (priority 2).
    const plan = [
      { action: "limitFirst", parameters: { count: 1 }, priority: 2 },
      { action: "sortBookmarks", parameters: { sortBy: "rating", order: "desc" }, priority: 1 },
    ];
    const result = applyAgentPlan(plan, list);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe("1"); // highest rating after sort-then-limit
  });
});
