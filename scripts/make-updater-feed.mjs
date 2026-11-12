// Builds latest.json (the in-app updater feed) from a release's signed assets.
//
// The Windows and Linux builds run as separate CI jobs, so neither can write a
// feed that covers both. This runs once after they finish:
//
//   node scripts/make-updater-feed.mjs <tag> <owner/repo> <sig-dir> <out-file> [notes-file]
//
// <sig-dir> holds the downloaded *.sig files; their names (minus .sig) are the
// asset names on the release.

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const [tag, repo, sigDir, outFile, notesFile] = process.argv.slice(2);
if (!tag || !repo || !sigDir || !outFile) {
  console.error(
    "usage: make-updater-feed.mjs <tag> <owner/repo> <sig-dir> <out-file> [notes-file]",
  );
  process.exit(2);
}

const version = tag.replace(/^v/, "");
const sigs = readdirSync(sigDir).filter((name) => name.endsWith(".sig"));

/** Updater platform keys, and how to recognise the matching asset. */
const targets = [
  { keys: ["windows-x86_64", "windows-x86_64-nsis"], match: /-setup\.exe$/ },
  { keys: ["linux-x86_64", "linux-x86_64-appimage"], match: /\.AppImage$/ },
  { keys: ["linux-x86_64-deb"], match: /\.deb$/, optional: true },
];

const platforms = {};
for (const target of targets) {
  const sig = sigs.find((name) => target.match.test(name.slice(0, -4)));
  if (!sig) {
    if (target.optional) continue;
    console.error(`No signed asset for ${target.keys[0]} (have: ${sigs.join(", ") || "none"})`);
    process.exit(1);
  }
  const asset = sig.slice(0, -4);
  const entry = {
    signature: readFileSync(join(sigDir, sig), "utf8").trim(),
    url: `https://github.com/${repo}/releases/download/${tag}/${encodeURIComponent(asset)}`,
  };
  for (const key of target.keys) platforms[key] = entry;
}

const notes =
  notesFile && existsSync(notesFile)
    ? readFileSync(notesFile, "utf8").trim()
    : `StepUnder ${tag}`;

writeFileSync(
  outFile,
  `${JSON.stringify({ version, notes, pub_date: new Date().toISOString(), platforms }, null, 2)}\n`,
);
console.log(`Wrote ${outFile} for ${version}: ${Object.keys(platforms).join(", ")}`);
