#!/usr/bin/env node
/**
 * Fails if the retired mark name appears in a tracked path or in text,
 * except the exact deletion-record path in the changelog.
 * The name is built from code points so this file does not contain it.
 */
import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTextFiles } from "./scan-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEEDLE = String.fromCharCode(99, 117, 98, 101, 98, 111, 116);
const DELETION_RECORD = `assets/brand/maqkrs-mark-${NEEDLE}@1x.png`;
const BADGE_PREFIX = "built-by-maqkrs";
const BADGE_PATH = "assets/brand/built-by-maqkrs-dark@2x.png";
const BADGE_HASH = "3fa4d33483ed49cf3ac0ef5d323b185281b22298e4027e026d1025670944a0d3";
const CHECKER = "scripts/check-banned-mark.mjs";
const CHANGELOG = "docs/CHANGELOG.md";

function deletionSpans(text) {
  const spans = [];
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(DELETION_RECORD, from);
    if (index === -1) {
      break;
    }
    spans.push([index, index + DELETION_RECORD.length]);
    from = index + DELETION_RECORD.length;
  }
  return spans;
}

function covered(spans, start, end) {
  return spans.some(([spanStart, spanEnd]) => start >= spanStart && end <= spanEnd);
}

export function findMarkHits(text) {
  const haystack = text.toLowerCase();
  const needle = NEEDLE.toLowerCase();
  const spans = deletionSpans(text);
  const hits = [];
  let from = 0;
  while (from < haystack.length) {
    const index = haystack.indexOf(needle, from);
    if (index === -1) {
      break;
    }
    const end = index + needle.length;
    if (!covered(spans, index, end)) {
      hits.push(index);
    }
    from = end;
  }
  return hits;
}

function lineNumber(text, index) {
  let line = 1;
  for (let i = 0; i < index; i += 1) {
    if (text.charCodeAt(i) === 10) {
      line += 1;
    }
  }
  return line;
}

function selfTest() {
  const sample = `removed ${DELETION_RECORD} only`;
  if (findMarkHits("plain heading") .length !== 0) {
    console.error("self-test failed: plain text");
    process.exit(2);
  }
  if (findMarkHits(NEEDLE).length !== 1) {
    console.error("self-test failed: name");
    process.exit(2);
  }
  if (findMarkHits(NEEDLE.toUpperCase()).length !== 1) {
    console.error("self-test failed: case");
    process.exit(2);
  }
  if (findMarkHits(sample).length !== 0) {
    console.error("self-test failed: deletion record");
    process.exit(2);
  }
  if (findMarkHits(`${sample} and ${NEEDLE}`).length !== 1) {
    console.error("self-test failed: name beside the record");
    process.exit(2);
  }
  if (findBadgeTextHits("README.md", "Built by MaQkrs").length !== 0) {
    console.error("self-test failed: plain footer");
    process.exit(2);
  }
  if (findBadgeTextHits("README.md", BADGE_PATH).length !== 1) {
    console.error("self-test failed: badge path outside the changelog");
    process.exit(2);
  }
  if (findBadgeTextHits("README.md", BADGE_HASH).length !== 1) {
    console.error("self-test failed: badge hash outside the changelog");
    process.exit(2);
  }
  if (findBadgeTextHits(CHANGELOG, `${BADGE_PATH} ${BADGE_HASH}`).length !== 0) {
    console.error("self-test failed: changelog record");
    process.exit(2);
  }
  if (findBadgeTextHits(CHANGELOG, `${BADGE_PATH} and built-by-maqkrs-light`).length !== 1) {
    console.error("self-test failed: extra badge name");
    process.exit(2);
  }
}

function spansOf(text, exact) {
  const spans = [];
  let from = 0;
  while (from <= text.length) {
    const index = text.indexOf(exact, from);
    if (index === -1) {
      break;
    }
    spans.push([index, index + exact.length]);
    from = index + exact.length;
  }
  return spans;
}

export function findBadgeTextHits(rel, text) {
  if (rel === CHECKER) {
    return [];
  }
  const spans = rel === CHANGELOG
    ? [...spansOf(text, BADGE_PATH), ...spansOf(text, BADGE_HASH)]
    : [];
  const hits = [];
  const rules = [
    { needle: BADGE_PREFIX, flags: "i" },
    { needle: BADGE_HASH, flags: "i" },
  ];
  for (const rule of rules) {
    const haystack = rule.flags === "i" ? text.toLowerCase() : text;
    const needle = rule.flags === "i" ? rule.needle.toLowerCase() : rule.needle;
    let from = 0;
    while (from < haystack.length) {
      const index = haystack.indexOf(needle, from);
      if (index === -1) {
        break;
      }
      const end = index + needle.length;
      if (!covered(spans, index, end)) {
        hits.push(index);
      }
      from = end;
    }
  }
  return hits;
}

function walkFiles(dir, out) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === ".git") {
      continue;
    }
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(absolute, out);
    } else if (entry.isFile()) {
      out.push(absolute);
    }
  }
  return out;
}

function fileHash(absolute) {
  return createHash("sha256").update(readFileSync(absolute)).digest("hex");
}

function trackedPaths() {
  return execSync("git ls-files", { cwd: ROOT, encoding: "utf8" })
    .split("\n")
    .filter(Boolean);
}

function main() {
  selfTest();
  const findings = [];
  for (const rel of trackedPaths()) {
    if (rel.toLowerCase().includes(NEEDLE.toLowerCase())) {
      findings.push(`path ${rel}`);
    }
    if (rel.toLowerCase().includes(BADGE_PREFIX)) {
      findings.push(`path ${rel}`);
    }
  }
  for (const absolute of walkFiles(ROOT, [])) {
    const rel = path.relative(ROOT, absolute).split(path.sep).join("/");
    if (rel.toLowerCase().includes(BADGE_PREFIX)) {
      findings.push(`path ${rel}`);
    }
    if (fileHash(absolute) === BADGE_HASH) {
      findings.push(`hash ${rel}`);
    }
  }
  for (const rel of listTextFiles(ROOT)) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    for (const index of findMarkHits(text)) {
      findings.push(`${rel}:${lineNumber(text, index)}`);
    }
    for (const index of findBadgeTextHits(rel, text)) {
      findings.push(`${rel}:${lineNumber(text, index)}`);
    }
  }
  if (findings.length > 0) {
    console.error(`banned mark: ${findings.length} hit${findings.length === 1 ? "" : "s"}`);
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log("banned mark: 0 hits");
}

main();
