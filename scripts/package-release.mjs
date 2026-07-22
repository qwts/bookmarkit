#!/usr/bin/env node

// Packages dist/ into the release assets published by release.yml (#8):
//
//   release/bookmarkit-v<version>.zip         <- load-unpacked-able / Web-Store-uploadable
//   release/bookmarkit-v<version>.zip.sha256  <- checksum, verifiable with `shasum -c`
//
// Run after `npm run build:chrome`. The archive root must be the extension root (manifest.json at
// the top level), because Chrome rejects a zip whose manifest sits inside a wrapper directory.

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { promisify } from "node:util";
import { pathToFileURL } from "node:url";
import { evaluateVersionArtifacts } from "./check-version-policy.mjs";

const execFileAsync = promisify(execFile);
const DIST_DIRECTORY = "dist";
const RELEASE_DIRECTORY = "release";

export function expectedReleaseTag(version) {
  return `v${version}`;
}

export function validateReleaseTag(tag, version) {
  const expected = expectedReleaseTag(version);
  return tag === expected ? [] : [`release tag must be exactly "${expected}", got "${tag}"`];
}

export function releaseArtifactNames(version) {
  const archive = `bookmarkit-${expectedReleaseTag(version)}.zip`;
  return { archive, checksum: `${archive}.sha256` };
}

// The zip is what users install, so refuse to build one that Chrome would reject or that carries
// paths escaping the archive root.
export function validateArchiveEntries(entries) {
  const errors = [];
  const normalized = entries.filter(Boolean);

  if (!normalized.includes("manifest.json")) {
    errors.push(
      "archive must contain manifest.json at its root (Chrome rejects a nested manifest)"
    );
  }
  if (!normalized.includes("background.js"))
    errors.push("archive must contain background.js at its root");
  if (!normalized.includes("index.html"))
    errors.push("archive must contain index.html at its root");
  if (!normalized.includes("popup.html"))
    errors.push("archive must contain popup.html at its root");
  if (!normalized.includes("LICENSE")) errors.push("archive must contain LICENSE at its root");
  if (!normalized.includes("THIRD-PARTY-NOTICES.md"))
    errors.push("archive must contain THIRD-PARTY-NOTICES.md at its root");

  for (const entry of normalized) {
    if (
      entry.startsWith("/") ||
      entry.startsWith("../") ||
      entry.includes("/../") ||
      entry.includes("\\")
    ) {
      errors.push(`archive entry is not a safe relative POSIX path: "${entry}"`);
    }
    if (entry === ".DS_Store" || entry.endsWith("/.DS_Store")) {
      errors.push(`archive contains forbidden metadata file: "${entry}"`);
    }
    if (entry.endsWith(".map")) {
      errors.push(
        `archive contains a sourcemap ("${entry}") — release builds must not ship sources`
      );
    }
  }
  return errors;
}

async function listFiles(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const relative = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) {
      files.push(...(await listFiles(path.join(directory, entry.name), relative)));
    } else {
      files.push(relative);
    }
  }
  // Sorted so the file list (and therefore the archive) is deterministic across machines.
  return files.sort();
}

function requestedTag(args) {
  const index = args.indexOf("--tag");
  if (index === -1) return null;
  const tag = args[index + 1];
  if (!tag || tag.startsWith("--")) throw new Error("--tag requires a value");
  return tag;
}

async function main() {
  const pkg = JSON.parse(await readFile("package.json", "utf8"));
  const lock = JSON.parse(await readFile("package-lock.json", "utf8"));

  let manifest;
  try {
    manifest = JSON.parse(await readFile(`${DIST_DIRECTORY}/manifest.json`, "utf8"));
  } catch {
    throw new Error(`No ${DIST_DIRECTORY}/manifest.json — run \`npm run build:chrome\` first.`);
  }

  const version = String(pkg.version);
  // Validate against the BUILT manifest, not the source one: this asserts the artifact we are
  // about to publish carries the right version, which is the thing users actually install.
  const errors = evaluateVersionArtifacts({
    packageVersion: version,
    manifestVersion: String(manifest.version),
    lockVersion: lock.version,
    lockRootVersion: lock.packages?.[""]?.version,
  });

  const tag = requestedTag(process.argv.slice(2));
  if (tag) errors.push(...validateReleaseTag(tag, version));

  const files = await listFiles(DIST_DIRECTORY);
  errors.push(...validateArchiveEntries(files));

  if (errors.length > 0) {
    throw new Error(
      `Release package validation failed:\n${errors.map((e) => `  - ${e}`).join("\n")}`
    );
  }

  await rm(RELEASE_DIRECTORY, { recursive: true, force: true });
  await mkdir(RELEASE_DIRECTORY, { recursive: true });

  const names = releaseArtifactNames(version);
  const archivePath = path.resolve(RELEASE_DIRECTORY, names.archive);
  // -X drops extra file attributes (uid/gid, .DS_Store resource forks) that vary by machine.
  await execFileAsync("zip", ["-X", "-q", archivePath, ...files], { cwd: DIST_DIRECTORY });

  // Read the archive back rather than trusting what we intended to write.
  const { stdout } = await execFileAsync("unzip", ["-Z1", archivePath]);
  const archived = stdout.split(/\r?\n/u).filter(Boolean).sort();
  const archiveErrors = validateArchiveEntries(archived);
  if (archiveErrors.length > 0 || archived.join("\n") !== files.join("\n")) {
    throw new Error(
      `Created archive does not match the validated build${archiveErrors.length ? `:\n${archiveErrors.join("\n")}` : "."}`
    );
  }

  const digest = createHash("sha256")
    .update(await readFile(archivePath))
    .digest("hex");
  await writeFile(path.join(RELEASE_DIRECTORY, names.checksum), `${digest}  ${names.archive}\n`);

  console.log(
    `Release package: ${path.relative(process.cwd(), archivePath)} (${archived.length} files)`
  );
  console.log(`SHA-256: ${digest}`);
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
  });
}
