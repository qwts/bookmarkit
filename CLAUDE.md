# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Build with sourcemaps, no minification (NOT a live dev server — outputs to dist/)
npm run build        # Production build to dist/
npm run build:chrome # Production build + copy manifest/background/icons to dist/ for Chrome extension
npm run preview      # Serve the dist/ folder locally
npm run lint         # Run ESLint
npm test             # Run the Vitest suite once
npm run test:watch   # Vitest in watch mode
```

> **Important:** `npm run dev` runs `vite build --mode development`, not `vite`. There is no HMR dev server — the output goes to `dist/`. Preview with `npm run preview` after each build.

Tests run on Vitest + Testing Library (jsdom), colocated as `src/**/*.test.{js,jsx}`. Pure utils
(`bookmarkFilters`, `manualFilters`, `duplicates`, `url`, `keyCrypto`, `parser`) have unit coverage;
components are tested with mocked `chrome.*` globals and a faked store.

## Architecture

### Dual deployment target

The app ships as both a **Vite/React web app** and a **Chrome MV3 extension**. The UI is identical in both; the difference is storage backend and extension-specific files (`public/manifest.json`, `public/background.js`). `npm run build:chrome` copies those into `dist/` after the Vite build. There is no content script — nothing is injected into web pages.

> Note: the default `LOCAL` store needs the `chrome.bookmarks` API, so the web-app target only
> functions with `__use_firebase__` set. There is no plain-localStorage-only store.

### Build entry points

Vite builds **two** HTML entries (`rollupOptions.input` in `vite.config.js`):

| Entry        | Source                            | Becomes                                              |
| ------------ | --------------------------------- | ---------------------------------------------------- |
| `index.html` | `src/main.jsx` → `BookmarkApp`    | The full app (opened in a tab)                       |
| `popup.html` | `src/popup/main.jsx` → `QuickAdd` | The extension toolbar popup (`action.default_popup`) |

`popup.html` lives at the repo root (not `public/`) because it's a real Vite entry — `build-chrome.js`
must **not** copy anything over `dist/popup.html`.

### Component structure

All bookmark UI state and logic lives in a single large component: `src/components/BookmarkApp.jsx`. This is intentional — it holds the store ref, LLM agent engine, keyboard shortcuts, theme state, and all modal visibility. `src/App.jsx` is a thin wrapper that just renders `BookmarkApp`.

Modal components (`BookmarkForm`, `ImportExportContent`, `DeleteConfirmModal`, `HelpModal`, `OptionsModal`, `MessageModal`) are all rendered inline in `BookmarkApp` with portal-style full-screen overlays.

`src/popup/QuickAdd.jsx` is a separate top-level component for the toolbar popup. It reuses
`useBookmarkStore`/`useTheme` so the popup and the app never diverge into two write paths.

### Filtering: two layers

`displayedBookmarks` is computed as **agent plan first, manual filters second**:

```
bookmarks → applyAgentPlan(lastAction) → applyManualFilters(effectiveFilters) → displayedBookmarks
```

- `src/utils/bookmarkFilters.js` — pure primitives + the agent plan (`applyAgentPlan`, `mergeAgentPlan`).
- `src/utils/manualFilters.js` — the LLM-free `FilterBar` layer, composing those same primitives.

Manual sort runs last, so it wins over an agent sort. The two clear independently ("Clear filters" vs
"Clear Search"); the empty-state CTA clears both.

### Store abstraction (`src/stores/`)

Three implementations share a common interface:

| Store             | File                      | When used                                                                                                                  |
| ----------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `LOCAL` (default) | `localCompositeStore.js`  | Chrome Bookmarks API for title/URL + `localStorage` (prefix `bm_meta:<id>`) for metadata (tags, rating, description, etc.) |
| `CHROME`          | `chromeBookmarksStore.js` | Raw Chrome Bookmarks API only — no metadata persistence                                                                    |
| `FIREBASE`        | `firebaseStore.js`        | Firestore under `artifacts/<appId>/users/<uid>/bookmarks`                                                                  |

Selected at startup in `BookmarkApp.jsx` based on the `__use_firebase__` build-time global. Factory is in `src/stores/index.js`.

**Common store interface:**
`init()`, `list()`, `subscribe(cb)`, `create(b)`, `update(id, patch)`, `remove(id)`, `removeMany(ids)`, `bulkReplace(arr)`, `bulkAdd(arr)`, `reorderBookmarks(ids)`, `persistSortedOrder({ sortBy, order })`

### LLM agent (`src/llm/`)

`src/llm/index.js` is the factory; provider implementations are in `src/llm/providers/`. All expose a single method: `generate(prompt): Promise<string>`.

The agent engine in `BookmarkApp.jsx` (`agentEngine()`) sends a structured prompt to the LLM and parses the JSON response into an array of `{ action, parameters, priority }` steps. These steps are accumulated in `lastAction` state and applied via `applyAgentPlan()` + `useMemo` to produce `displayedBookmarks`. On LLM failure, it falls back to a basic `searchBookmarks` action.

### Theming

Tailwind is configured to use CSS variables (`--bg-primary`, `--bg-secondary`, `--text-primary`, `--text-secondary`, `--border`, `--accent`, `--accent-hover`). Themes are JSON/YAML files with those seven keys. The active theme and custom themes are persisted to `chrome.storage.local` (extension) or `localStorage` (web), under keys `bm_current_theme` and `bm_themes`. The `dark-theme.json` in the repo root is an example importable theme file.

### Build-time globals

These Vite `define` globals can be set in `vite.config.js` or `.env` files:

- `__llm_provider__` — default LLM provider key (e.g. `'gemini'`)
- `__llm_options__` — default provider options object
- `__use_firebase__` — `true` to use Firestore instead of local store
- `__firebase_config` — JSON-stringified Firebase config object
- `__app_id` — Firestore collection namespace
- `__initial_auth_token` — optional custom auth token for Firebase

Runtime overrides (set via the in-app Options dialog) are stored in `localStorage` under `bm_runtime_llm_provider` and `bm_runtime_llm_options` and take precedence over build-time defaults.

### Key localStorage / chrome.storage keys

| Key                       | Purpose                                            |
| ------------------------- | -------------------------------------------------- |
| `bm_runtime_llm_provider` | Selected LLM provider                              |
| `bm_runtime_llm_options`  | Per-provider options (API keys, base URLs, models) |
| `bm_current_theme`        | Active theme name                                  |
| `bm_themes`               | JSON of custom uploaded themes                     |
| `bm_meta:<id>`            | Per-bookmark metadata (localCompositeStore)        |
