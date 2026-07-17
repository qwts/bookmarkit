#!/usr/bin/env node

// Version policy (#8): package.json, public/manifest.json, and package-lock.json must all carry
// the same stable three-component semver.
//
// Why this is a gate rather than a convention: the manifest version is what Chrome shows the user
// and what the update check compares, so a manifest that drifts from package.json ships a build
// that lies about its own version — and the release tag is derived from package.json, so the drift
// is invisible until someone installs the zip. Checked in CI on every PR and again at release time
// against the actual built artifact.

import { readFile } from "node:fs/promises";
import process from "node:process";
import { pathToFileURL } from "node:url";

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/u;

// Chrome's own constraint: 1-4 dot-separated integers, each 0-65535, no leading zeros. We require
// exactly three so the version maps 1:1 onto a semver tag.
export function validateChromeExtensionVersion(version) {
  const value = String(version ?? "");
  if (!STABLE_SEMVER.test(value)) {
    return [
      `version must be stable three-component semver with no prefix or pre-release tag, got "${value}"`,
    ];
  }
  return value
    .split(".")
    .filter((part) => Number(part) > 65535)
    .map((part) => `version component "${part}" exceeds Chrome's 65535 maximum`);
}

export function evaluateVersionArtifacts({
  packageVersion,
  manifestVersion,
  lockVersion,
  lockRootVersion,
}) {
  const errors = validateChromeExtensionVersion(packageVersion);
  // Comparing other artifacts against an already-invalid version just produces noise.
  if (errors.length > 0) return errors;

  const mismatches = [];
  if (manifestVersion !== packageVersion)
    mismatches.push(`public/manifest.json (${manifestVersion})`);
  if (lockVersion !== packageVersion)
    mismatches.push(`package-lock.json .version (${lockVersion})`);
  if (lockRootVersion !== packageVersion) {
    mismatches.push(`package-lock.json .packages[""].version (${lockRootVersion})`);
  }
  if (mismatches.length > 0) {
    errors.push(
      `version artifacts are not synchronized with package.json (${packageVersion}): ${mismatches.join(", ")}. ` +
        "Run `npm run changeset:version` rather than editing versions by hand."
    );
  }
  return errors;
}

async function readJson(file) {
  return JSON.parse(await readFile(file, "utf8"));
}

async function main() {
  // --built checks the packaged output instead of the source manifest, so release packaging can
  // assert the zip it is about to publish carries the right version.
  const builtMode = process.argv.includes("--built");
  const manifestPath = builtMode ? "dist/manifest.json" : "public/manifest.json";

  const [pkg, manifest, lock] = await Promise.all([
    readJson("package.json"),
    readJson(manifestPath),
    readJson("package-lock.json"),
  ]);

  const errors = evaluateVersionArtifacts({
    packageVersion: String(pkg.version),
    manifestVersion: String(manifest.version),
    lockVersion: lock.version,
    lockRootVersion: lock.packages?.[""]?.version,
  });

  if (errors.length > 0) {
    console.error(`Version policy failed (${manifestPath}):`);
    for (const error of errors) console.error(`  - ${error}`);
    process.exitCode = 1;
    return;
  }
  console.log(
    `Version policy OK: package.json, ${manifestPath}, and package-lock.json all at ${pkg.version}.`
  );
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
