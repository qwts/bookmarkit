# Changesets

This folder is managed by [Changesets](https://github.com/changesets/changesets). It drives the
release flow described in `AGENTS.md` and `README.md`:

1. Add a changeset to any PR that changes user-facing behavior: `npm run changeset`.
2. When changesets land on `main`, `version-cut.yml` opens (or refreshes) a rolling
   **"chore: version bookmarkit"** PR. It updates package versions and `CHANGELOG.md`;
   merging that PR is the human "cut a release" action.
3. Merging it bumps the version, tags `v<version>`, and `release.yml` publishes the packaged
   extension zip to a GitHub Release.

A PR with no user-facing change (docs, CI, tests) doesn't need a changeset.
