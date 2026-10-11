#!/usr/bin/env node
/**
 * Banned-claims gate for the profile README, docs, and other user-facing text.
 *
 * Lines 1-4 of the denylist are case-insensitive, except the MD token, which
 * is case-sensitive so a ".md" filename does not match. Line 5 is
 * case-sensitive so the display spelling "MaQkrs" does not match.
 *
 * This file is not scanned. It is the denylist, not a claim about a person.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { listTextFiles } from "./scan-text.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

// Allow-list exact URL, path, repo slug, or ID strings. A hit that sits
// entirely inside one of these strings is ignored. Display text stays "MaQkrs".
const ALLOW_EXACT = [
  "https://github.com/astrachan163/MaqkrsTutor-public",
  "MaqkrsTutor-public",
  "/maqkrstutor/",
  "https://www.nonartificialsi.com/maqkrstutor/",
];

const CASE_INSENSITIVE = [
  String.raw`Doctor of Medicine`,
  String.raw`\bM\.D\.`,
  String.raw`M\.D\. Candidate`,
  String.raw`four years of medical school`,
  String.raw`medical school graduate`,
  String.raw`federal licensing`,
  String.raw`two MSDH-licensed businesses`,
  String.raw`stood up two licensed`,
  String.raw`hired after licensing`,
  String.raw`required full FDA`,
  String.raw`Georgia[^.]{0,40}standards`,
  String.raw`aligned with [^.]{0,30}standards`,
  String.raw`\bGSE\b`,
  String.raw`Milestones aligned`,
  String.raw`30-day (free )?trial`,
  String.raw`God Mode`,
  String.raw`Cybersecurity Systems Engineer`,
  String.raw`Clearable`,
  String.raw`\bFellow\b`,
  String.raw`Pre-Vetted`,
  String.raw`Tier 5`,
  String.raw`His Name`,
  String.raw`seeking internships?`,
];

const CASE_SENSITIVE = [
  String.raw`\bMD\b`,
  String.raw`Apple ID`,
  String.raw`\bGBA\b`,
  String.raw`Game ?Boy`,
  String.raw`Nintendo`,
  String.raw`\bMaqkrs\b(?![-/._a-zA-Z0-9])`,
  String.raw`MaQkRs`,
];

function allowSpans(text) {
  const spans = [];
  for (const exact of ALLOW_EXACT) {
    let from = 0;
    while (from <= text.length) {
      const index = text.indexOf(exact, from);
      if (index === -1) {
        break;
      }
      spans.push([index, index + exact.length]);
      from = index + exact.length;
    }
  }
  return spans;
}

function covered(spans, start, end) {
  return spans.some(([spanStart, spanEnd]) => start >= spanStart && end <= spanEnd);
}

export function findClaims(text) {
  const spans = allowSpans(text);
  const hits = [];
  const groups = [
    { sources: CASE_INSENSITIVE, flags: "gi" },
    { sources: CASE_SENSITIVE, flags: "g" },
  ];
  for (const group of groups) {
    for (const source of group.sources) {
      const re = new RegExp(source, group.flags);
      let match = re.exec(text);
      while (match !== null) {
        const start = match.index;
        const end = start + match[0].length;
        if (match[0].length === 0) {
          re.lastIndex += 1;
        } else if (!covered(spans, start, end)) {
          hits.push({ start, end, text: match[0], source });
        }
        match = re.exec(text);
      }
    }
  }
  hits.sort((a, b) => a.start - b.start || a.end - b.end);
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

function assertCase(label, text, expectHit) {
  const hits = findClaims(text);
  const hit = hits.length > 0;
  if (hit !== expectHit) {
    console.error(`self-test failed: ${label} (hits=${hits.length})`);
    process.exit(2);
  }
}

function selfTest() {
  assertCase("fellow", "SFS Fellow", true);
  assertCase("headline scholar", "CyberAICorps Scholar", false);
  assertCase("display spelling", "MaQkrs AI Tutor", false);
  assertCase("wrong camel", "MaQkRs", true);
  assertCase("bare misspelling", "Maqkrs brand", true);
  assertCase("repo slug", "MaqkrsTutor-public", false);
  assertCase("repo url", "https://github.com/astrachan163/MaqkrsTutor-public", false);
  assertCase("site path", "https://www.nonartificialsi.com/maqkrstutor/", false);
  assertCase("md extension", "README.md", false);
  assertCase("md token", "an MD degree", true);
  assertCase("lower md", "an md file", false);
  assertCase("degree phrase", "Doctor of Medicine", true);
  assertCase("degree phrase lower", "doctor of medicine", true);
  assertCase("internship", "seeking internship", true);
  assertCase("internships", "seeking internships", true);
  assertCase("faith line", "in His Name", true);
  assertCase("game boy spaced", "Game Boy", true);
  assertCase("game boy closed", "GameBoy", true);
  assertCase("standards line", "aligned with state standards", true);
}

function main() {
  selfTest();
  const skip = new Set(["scripts/check-claims.mjs"]);
  const files = listTextFiles(ROOT, skip);
  const findings = [];
  for (const rel of files) {
    const text = readFileSync(path.join(ROOT, rel), "utf8");
    for (const hit of findClaims(text)) {
      findings.push(`${rel}:${lineNumber(text, hit.start)}: ${hit.text}`);
    }
  }
  if (findings.length > 0) {
    console.error(`claims gate: ${findings.length} hit${findings.length === 1 ? "" : "s"}`);
    for (const finding of findings) {
      console.error(finding);
    }
    process.exit(1);
  }
  console.log(`claims gate: 0 hits (${files.length} files)`);
}

main();
