// #53: Deterministic filter controls — the LLM-free path to filtering/sorting.
// Everything here is local: no network, no provider, no API key. The agent bar is a
// convenience layer on top of these same primitives, not a prerequisite for them.

import React, { useMemo, useState } from "react";
import { TAG_STATE, getTagState, hasActiveFilters } from "../utils/manualFilters.js";

const SORT_FIELDS = [
  { value: "", label: "Default order" },
  { value: "title", label: "Title" },
  { value: "url", label: "URL" },
  { value: "rating", label: "Rating" },
  { value: "folderId", label: "Folder" },
  { value: "createdAt", label: "Date added" },
  { value: "updatedAt", label: "Date modified" },
];

const VISIBLE_TAG_LIMIT = 12;

const controlClass =
  "px-2 py-1 text-sm rounded-md border border-border themed-input focus:outline-none focus:ring-2 focus:ring-accent";

function TagChip({ tag, count, state, onClick }) {
  const base =
    "px-2 py-0.5 text-xs rounded-full border transition-colors focus:outline-none focus:ring-2 focus:ring-accent";
  const styles = {
    [TAG_STATE.INCLUDE]: "bg-accent text-white border-accent",
    [TAG_STATE.EXCLUDE]: "bg-secondary-bg text-secondary-text border-border line-through opacity-70",
    [TAG_STATE.OFF]: "bg-primary-bg text-primary-text border-border hover:bg-secondary-bg",
  };
  const hint = {
    [TAG_STATE.INCLUDE]: "including",
    [TAG_STATE.EXCLUDE]: "excluding",
    [TAG_STATE.OFF]: "not filtered",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      className={`${base} ${styles[state]}`}
      // Chips are tri-state, so aria-pressed (binary) would misreport "exclude".
      // Spell the state out for screen readers instead.
      aria-label={`Tag ${tag}, ${count} bookmark${count === 1 ? "" : "s"}, ${hint[state]}. Activate to cycle include, exclude, off.`}
    >
      {state === TAG_STATE.EXCLUDE ? "−" : ""}
      {tag}
      <span className="ml-1 opacity-60">{count}</span>
    </button>
  );
}

const FilterBar = React.memo(function FilterBar({ filters, tagFacets, onChange, onCycleTag, onClear }) {
  const [showAllTags, setShowAllTags] = useState(false);

  const visibleTags = useMemo(
    () => (showAllTags ? tagFacets : tagFacets.slice(0, VISIBLE_TAG_LIMIT)),
    [tagFacets, showAllTags],
  );

  const active = hasActiveFilters(filters);
  const hiddenCount = tagFacets.length - visibleTags.length;

  return (
    <div className="mb-3 p-2 rounded-lg border border-border bg-primary-bg" role="search" aria-label="Filter bookmarks">
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[10rem]">
          <label htmlFor="filter-text" className="sr-only">Filter bookmarks by text</label>
          <input
            id="filter-text"
            type="text"
            value={filters.text}
            onChange={(e) => onChange({ ...filters, text: e.target.value })}
            placeholder="Filter instantly (no AI)…"
            className={`${controlClass} w-full`}
          />
          {filters.text && (
            <button
              type="button"
              onClick={() => onChange({ ...filters, text: "" })}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-secondary-text hover:text-primary-text focus:outline-none focus:ring-2 focus:ring-accent rounded"
              aria-label="Clear text filter"
            >
              ✕
            </button>
          )}
        </div>

        <label htmlFor="filter-rating" className="sr-only">Minimum rating</label>
        <select
          id="filter-rating"
          value={filters.minRating}
          onChange={(e) => onChange({ ...filters, minRating: Number(e.target.value) })}
          className={controlClass}
        >
          <option value={0}>Any rating</option>
          {[1, 2, 3, 4, 5].map((n) => (
            <option key={n} value={n}>{"★".repeat(n)}+</option>
          ))}
        </select>

        <label htmlFor="filter-sort" className="sr-only">Sort by</label>
        <select
          id="filter-sort"
          value={filters.sortBy}
          onChange={(e) => onChange({ ...filters, sortBy: e.target.value })}
          className={controlClass}
        >
          {SORT_FIELDS.map((f) => (
            <option key={f.value} value={f.value}>{f.label}</option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onChange({ ...filters, order: filters.order === "asc" ? "desc" : "asc" })}
          disabled={!filters.sortBy}
          className={`${controlClass} disabled:opacity-40 disabled:cursor-not-allowed`}
          aria-label={`Sort direction: ${filters.order === "asc" ? "ascending" : "descending"}. Activate to reverse.`}
        >
          {filters.order === "asc" ? "↑ Asc" : "↓ Desc"}
        </button>

        {active && (
          <button
            type="button"
            onClick={onClear}
            className="px-2 py-1 text-sm rounded-md border border-border text-secondary-text hover:text-primary-text hover:bg-secondary-bg focus:outline-none focus:ring-2 focus:ring-accent"
          >
            Clear filters
          </button>
        )}
      </div>

      {tagFacets.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap mt-2">
          {visibleTags.map(({ tag, count }) => (
            <TagChip
              key={tag}
              tag={tag}
              count={count}
              state={getTagState(filters, tag)}
              onClick={() => onCycleTag(tag)}
            />
          ))}
          {hiddenCount > 0 && (
            <button
              type="button"
              onClick={() => setShowAllTags(true)}
              className="px-2 py-0.5 text-xs rounded-full border border-border text-secondary-text hover:bg-secondary-bg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              +{hiddenCount} more
            </button>
          )}
          {showAllTags && tagFacets.length > VISIBLE_TAG_LIMIT && (
            <button
              type="button"
              onClick={() => setShowAllTags(false)}
              className="px-2 py-0.5 text-xs rounded-full border border-border text-secondary-text hover:bg-secondary-bg focus:outline-none focus:ring-2 focus:ring-accent"
            >
              Show fewer
            </button>
          )}
        </div>
      )}
    </div>
  );
});

export default FilterBar;
