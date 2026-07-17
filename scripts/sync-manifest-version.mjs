#!/usr/bin/env node

// Runs immediately after `changeset version` (see the changeset:version script). Changesets only
// knows about package.json, so the manifest and the lockfile have to be dragged along in the same
// commit — otherwise the version PR merges a package.json bump while the extension still reports
// the old version, and check-version-policy fails on main.

import { readFile, writeFile } from "node:fs/promises";
import process from "node:process";
import { validateChromeExtensionVersion } from "./check-version-policy.mjs";

const MANIFEST_PATH = "public/manifest.json";

const pkg = JSON.parse(await readFile("package.json", "utf8"));
const version = String(pkg.version);

const versionErrors = validateChromeExtensionVersion(version);
if (versionErrors.length > 0) {
  console.error(`Refusing to copy invalid Chrome extension version "${version}":`);
  for (const error of versionErrors) console.error(`  - ${error}`);
  process.exit(1);
}

const manifestText = await readFile(MANIFEST_PATH, "utf8");
const manifest = JSON.parse(manifestText);
const lockText = await readFile("package-lock.json", "utf8");
const lock = JSON.parse(lockText);

// A lockfile whose root package isn't this package means we'd be stamping a version onto someone
// else's tree — bail rather than corrupt it.
if (lock.name !== pkg.name || lock.packages?.[""]?.name !== pkg.name) {
  console.error(
    "Refusing to update package-lock.json: its root package does not match package.json."
  );
  process.exit(1);
}

// Targeted string replace rather than a full re-serialize, so the manifest keeps its existing
// formatting and the version PR's diff is one line.
let updatedManifestText = manifestText;
if (manifest.version !== version) {
  updatedManifestText = manifestText.replace(
    `"version": "${manifest.version}"`,
    `"version": "${version}"`
  );
  if (JSON.parse(updatedManifestText).version !== version) {
    console.error(
      `Could not rewrite the version field in ${MANIFEST_PATH} (${manifest.version} -> ${version}).`
    );
    process.exit(1);
  }
  await writeFile(MANIFEST_PATH, updatedManifestText);
  console.log(`${MANIFEST_PATH}: ${manifest.version} -> ${version}`);
} else {
  console.log(`${MANIFEST_PATH} already at ${version}.`);
}

const previousLock = `${String(lock.version)}/${String(lock.packages[""].version)}`;
lock.version = version;
lock.packages[""].version = version;
const updatedLockText = `${JSON.stringify(lock, null, 2)}\n`;
if (updatedLockText === lockText) {
  console.log(`package-lock.json already at ${version}.`);
} else {
  await writeFile("package-lock.json", updatedLockText);
  console.log(`package-lock.json: ${previousLock} -> ${version}/${version}`);
}
