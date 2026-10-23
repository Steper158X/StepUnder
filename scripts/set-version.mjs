// Bump the app version everywhere the bundler, Cargo and the updater look.
//
//   bun run version:set 0.2.0
//
// Then commit, tag `v0.2.0` and push the tag: the Release workflow builds
// signed installers and publishes latest.json for the in-app updater.

import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import process from "node:process";

const version = process.argv[2];
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/;

if (!version || !SEMVER.test(version)) {
  console.error("Usage: bun run version:set <major.minor.patch>");
  process.exit(1);
}

/** Replace exactly one match; a missing match usually means the file moved. */
function update(path, pattern, replacement) {
  const file = resolve(path);
  const source = readFileSync(file, "utf8");
  if (!pattern.test(source)) {
    console.error(`Could not find the version field in ${path}`);
    process.exit(1);
  }
  writeFileSync(file, source.replace(pattern, replacement));
  console.log(`updated ${path}`);
}

update("package.json", /"version"\s*:\s*"[^"]*"/, `"version": "${version}"`);
update(
  "src-tauri/tauri.conf.json",
  /"version"\s*:\s*"[^"]*"/,
  `"version": "${version}"`,
);
update("src-tauri/Cargo.toml", /^version = "[^"]*"/m, `version = "${version}"`);
update(
  "src-tauri/Cargo.lock",
  /(name = "stepunder"\r?\nversion = ")[^"]*(")/,
  `$1${version}$2`,
);

console.log(`\nStepUnder is now ${version}. Next:`);
console.log(`  git commit -am "Release v${version}"`);
console.log(`  git tag v${version}`);
console.log("  git push origin main --tags");
