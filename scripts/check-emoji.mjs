#!/usr/bin/env node
/**
 * Emoji gate. Fails on emoji and symbol ranges in tracked text files.
 * Arrows U+2190-U+21FF are allowed. Lockfiles, fonts, and vendored trees
 * are skipped by the file walker.
 *
 * Banned ranges: U+1F000-U+1FAFF, U+2600-U+27BF, U+2B00-U+2BFF, U+FE0F,
 * plus U+2705, U+2714, U+2716, U+274C, and U+274E (those five also sit
 * inside U+2600-U+27BF).
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTextFiles } from "./scan-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const RANGES = [
  [0x1f000, 0x1faff],
  [0x2600, 0x27bf],
  [0x2b00, 0x2bff],
  [0xfe0f, 0xfe0f],
  [0x2705, 0x2705],
  [0x2714, 0x2714],
  [0x2716, 0x2716],
  [0x274c, 0x274c],
  [0x274e, 0x274e],
];

function isBanned(codePoint) {
  return RANGES.some(([start, end]) => codePoint >= start && codePoint <= end);
}

export function findEmoji(text) {
  const hits = [];
  for (let index = 0; index < text.length; ) {
    const codePoint = text.codePointAt(index);
    const width = codePoint > 0xffff ? 2 : 1;
    if (isBanned(codePoint)) {
      hits.push({ index, codePoint });
    }
    index += width;
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

function codeLabel(codePoint) {
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

function assertCase(label, text, expectHit) {
  const hit = findEmoji(text).length > 0;
  if (hit !== expectHit) {
    console.error(`self-test failed: ${label}`);
    process.exit(2);
  }
}

function selfTest() {
  assertCase("plain", "Andrew Strachan", false);
  assertCase("check", `status ${String.fromCodePoint(0x2705)}`, true);
  assertCase("cross", `status ${String.fromCodePoint(0x274c)}`, true);
  assertCase("variation", `mark ${String.fromCodePoint(0xfe0f)}`, true);
  assertCase("arrow", `next ${String.fromCodePoint(0x2192)}`, false);
  assertCase("dingbat range", `star ${String.fromCodePoint(0x2605)}`, true);
}

function main() {
  selfTest();
  const files = listTextFiles(ROOT);
  const findings = [];
  for (const rel of files) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    for (const hit of findEmoji(text)) {
      findings.push(`${rel}:${lineNumber(text, hit.index)}: ${codeLabel(hit.codePoint)}`);
    }
  }
  if (findings.length > 0) {
    console.error(`emoji gate: ${findings.length} hit${findings.length === 1 ? "" : "s"}`);
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log(`emoji gate: 0 hits (${files.length} files)`);
}

main();
