#!/usr/bin/env node
/**
 * Fails if the retired mark name appears in a tracked path or in text,
 * except the exact deletion-record path in the changelog.
 * The name is built from code points so this file does not contain it.
 */
import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTextFiles } from "./scan-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const NEEDLE = String.fromCharCode(99, 117, 98, 101, 98, 111, 116);
const DELETION_RECORD = `assets/brand/maqkrs-mark-${NEEDLE}@1x.png`;

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
  }
  for (const rel of listTextFiles(ROOT)) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    for (const index of findMarkHits(text)) {
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
