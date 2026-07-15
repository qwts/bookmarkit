// ARCH-06, PERF-08: Pure bookmark filter/sort/limit functions extracted from BookmarkApp.jsx.
// No React or DOM dependencies — independently testable.
// PERF-08: Defined outside the component so references are stable across renders.

export const searchBookmarks = (searchTerm, list) => {
  const lower = (searchTerm || "").toLowerCase();
  if (!lower) return list;
  return list.filter(
    (b) =>
      (b.title?.toLowerCase() || "").includes(lower) ||
      (b.url?.toLowerCase() || "").includes(lower) ||
      (b.description?.toLowerCase() || "").includes(lower) ||
      (b.tags && b.tags.some((tag) => tag.toLowerCase().includes(lower))),
  );
};

export const findWithTags = (includeTags = [], excludeTags = [], list) => {
  const lowerInclude = includeTags.map((t) => t.toLowerCase());
  const lowerExclude = excludeTags.map((t) => t.toLowerCase());
  return list.filter((b) => {
    const bookmarkTags = b.tags ? b.tags.map((bt) => bt.toLowerCase()) : [];
    return (
      lowerInclude.every((tag) => bookmarkTags.includes(tag)) &&
      !lowerExclude.some((tag) => bookmarkTags.includes(tag))
    );
  });
};

export const findIncludes = (field, value, list) => {
  const lowerValue = (value || "").toLowerCase();
  return list.filter((b) => ((b[field] || "") + "").toLowerCase().includes(lowerValue));
};

export const findStartsWith = (field, value, list) => {
  const lowerValue = (value || "").toLowerCase();
  return list.filter((b) => {
    if (field === "tags") {
      const tags = Array.isArray(b.tags) ? b.tags : [];
      return tags.some((t) => (t || "").toString().toLowerCase().startsWith(lowerValue));
    }
    const val = ((b[field] ?? "") + "").toLowerCase();
    return lowerValue ? val.startsWith(lowerValue) : true;
  });
};

export const filterByRating = (params = {}, list) => {
  const { minRating, maxRating, comparator, exact } = params || {};
  const hasExact = typeof exact === "number" || comparator === "eq";
  const min = hasExact
    ? (typeof exact === "number" ? exact : minRating) || 0
    : typeof minRating === "number"
      ? minRating
      : 0;
  const max = hasExact ? min : typeof maxRating === "number" ? maxRating : 5;
  return list.filter((b) => {
    const r = b.rating || 0;
    if (comparator === "gte") return r >= min;
    if (comparator === "lte") return r <= min;
    if (comparator === "eq" || hasExact) return r === min;
    return r >= min && r <= max;
  });
};

export const sortBookmarks = (sortBy, order, list) => {
  const ord = (order || "asc").toLowerCase();
  return [...list].sort((a, b) => {
    let valA = a[sortBy];
    let valB = b[sortBy];
    if (valA === undefined || valA === null) valA = "";
    if (valB === undefined || valB === null) valB = "";
    if (typeof valA === "number" && typeof valB === "number") {
      return ord === "asc" ? valA - valB : valB - valA;
    }
    if (typeof valA === "string") valA = valA.toLowerCase();
    if (typeof valB === "string") valB = valB.toLowerCase();
    if (ord === "asc") return valA < valB ? -1 : valA > valB ? 1 : 0;
    return valA > valB ? -1 : valA < valB ? 1 : 0;
  });
};

export const limitResults = (count, list, direction = "first") => {
  const n = Number(count) || 0;
  if (!n || n <= 0) return list;
  return direction === "last" ? list.slice(-n) : list.slice(0, n);
};

const RESET_ACTIONS = ["resetSearch", "showAllBookmarks"];

// #21: Order steps by their numeric `priority` (lower runs first), falling back
// to original array order for ties or when no step declares a priority. Shared
// by applyAgentPlan (display) and the agent's imperative side-effect loop so
// both honor the ordering the LLM was asked to produce.
export const sortStepsByPriority = (steps = []) => {
  const list = Array.isArray(steps) ? steps : [steps];
  if (!list.some((s) => typeof s?.priority === "number")) return list;
  return list
    .map((s, idx) => ({ s, idx }))
    .sort((a, b) => a.s.priority - b.s.priority || a.idx - b.idx)
    .map((x) => x.s);
};

// #20: Merge a newly parsed plan into the accumulated one. New steps replace any
// prior step with the same action (so re-searching a different term does not
// stack on top of the old filter), while steps of a different action still
// refine the view. A reset/showAll clears the accumulated plan. This bounds the
// plan to at most one step per action instead of growing without limit.
export const mergeAgentPlan = (previous = [], steps = []) => {
  const prev = Array.isArray(previous) ? previous : previous ? [previous] : [];
  if (steps.some((s) => RESET_ACTIONS.includes(s.action))) return steps;
  // Replace a same-action prior step *in its original slot* so execution order
  // (which matters when steps carry no numeric priority) is preserved; only
  // genuinely new actions are appended (Codex #32).
  const replacement = new Map(steps.map((s) => [s.action, s]));
  const used = new Set();
  const merged = prev.map((s) => {
    if (replacement.has(s.action)) {
      used.add(s.action);
      return replacement.get(s.action);
    }
    return s;
  });
  for (const s of steps) {
    if (!used.has(s.action)) merged.push(s);
  }
  return merged;
};

// PERF-08: applyAgentPlan is a pure function — given the same plan + list it always
// returns the same reference-equal result when inputs are stable.
export const applyAgentPlan = (plan, list) => {
  if (!plan) return list;
  const actions = Array.isArray(plan) ? plan : [plan];
  const ordered = sortStepsByPriority(actions);
  let currentResults = [...list];
  for (const step of ordered) {
    const { action, parameters = {} } = step;
    if (
      [
        "importBookmarks", "exportBookmarks", "resetSearch",
        "showAllBookmarks", "removeDuplicates", "reorder",
        "reorderAscending", "reorderDescending", "persistSortedOrder",
      ].includes(action)
    )
      continue;
    switch (action) {
      case "searchBookmarks":
        currentResults = searchBookmarks(parameters.searchTerm || "", currentResults);
        break;
      case "findIncludes":
        currentResults = findIncludes(parameters.field || "title", parameters.value || "", currentResults);
        break;
      case "findStartsWith":
        currentResults = findStartsWith(parameters.field || "title", parameters.value || "", currentResults);
        break;
      case "findWithTags":
        currentResults = findWithTags(parameters.includeTags || [], parameters.excludeTags || [], currentResults);
        break;
      case "filterByRating":
        currentResults = filterByRating(parameters || {}, currentResults);
        break;
      case "sortBookmarks":
        currentResults = sortBookmarks(parameters.sortBy || "title", parameters.order || "asc", currentResults);
        break;
      case "limitResults":
        currentResults = limitResults(Number(parameters.count) || 0, parameters.scope === "all" ? list : currentResults, parameters.direction || "first");
        break;
      case "limitFirst":
        currentResults = limitResults(Number(parameters.count) || 0, currentResults, "first");
        break;
      case "limitLast":
        currentResults = limitResults(Number(parameters.count) || 0, currentResults, "last");
        break;
      default:
        break;
    }
  }
  return currentResults;
};
