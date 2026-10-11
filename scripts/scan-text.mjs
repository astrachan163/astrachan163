import { readdirSync } from "node:fs";
import path from "node:path";

const SKIP_DIRS = new Set([
  ".git",
  "node_modules",
  "vendor",
  "third_party",
  "dist",
  "build",
]);

const LOCKFILES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lock",
  "bun.lockb",
  "npm-shrinkwrap.json",
]);

const FONT_EXT = new Set([".woff", ".woff2", ".ttf", ".otf", ".eot"]);

const TEXT_EXT = new Set([
  ".md",
  ".mdx",
  ".html",
  ".css",
  ".svg",
  ".txt",
  ".js",
  ".mjs",
  ".cjs",
  ".ts",
  ".tsx",
  ".jsx",
  ".json",
  ".yml",
  ".yaml",
  ".swift",
  ".py",
  ".toml",
  ".xml",
  ".vue",
  ".svelte",
]);

/**
 * Tracked-style text files under root.
 * Skips lockfiles, fonts, and vendored trees. extraSkip is a set of
 * repo-relative paths using forward slashes.
 */
export function listTextFiles(root, extraSkip = new Set()) {
  const files = [];

  function walk(dir) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (SKIP_DIRS.has(entry.name)) {
        continue;
      }
      const absolute = path.join(dir, entry.name);
      const rel = path.relative(root, absolute).split(path.sep).join("/");
      if (entry.isDirectory()) {
        walk(absolute);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (LOCKFILES.has(entry.name) || extraSkip.has(rel)) {
        continue;
      }
      const ext = path.extname(entry.name).toLowerCase();
      if (FONT_EXT.has(ext)) {
        continue;
      }
      if (!TEXT_EXT.has(ext)) {
        continue;
      }
      files.push(rel);
    }
  }

  walk(root);
  files.sort();
  return files;
}
