# bookmarkit

## 0.1.0

### Minor Changes

- 9d67f77: Add a deterministic filter bar (tag chips, rating, sort, instant text filter) that works with no
  LLM configured, and a toolbar quick-add popup that bookmarks the current tab and edits an
  already-saved URL instead of duplicating it.

### Patch Changes

- f0fbb5e: Ship the MIT license and generated third-party notices in extension release archives.
- 9d67f77: Publish the packaged extension to GitHub Releases so installing no longer requires cloning and
  building. Every CI run also attaches the same zip as a downloadable artifact.
