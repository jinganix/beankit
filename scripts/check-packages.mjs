#!/usr/bin/env node
// Verify what each publishable package would actually ship: every package must
// carry its own README.md + LICENSE (npm does not walk up the monorepo), and
// every entry point declared in package.json must exist inside the tarball.
//
// Run with `npm run check:packages` (needs `dist/`, so build first).

import { execFile } from "node:child_process";
import { access, readdir, readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const run = promisify(execFile);
const WORKSPACES = (await readdir(join(ROOT, "packages"), { withFileTypes: true }))
  .filter((entry) => entry.isDirectory())
  .map((entry) => `packages/${entry.name}`);

/** Files the npm registry page and license compliance depend on. */
const REQUIRED = ["README.md", "LICENSE", "package.json"];

function packFiles(payload) {
  const results = Array.isArray(payload) ? payload : Object.values(payload ?? {});
  const result = results.find((entry) => Array.isArray(entry?.files));
  if (!result) {
    throw new Error("unexpected npm pack --json output");
  }
  return result.files.map((file) => file.path);
}

/** Entry points declared in package.json that must exist inside the tarball. */
function declaredEntries(pkg) {
  const entries = new Set();
  for (const field of ["main", "module", "types"]) {
    if (typeof pkg[field] === "string") entries.add(pkg[field]);
  }
  if (typeof pkg.bin === "string") entries.add(pkg.bin);
  if (pkg.bin && typeof pkg.bin === "object") {
    for (const value of Object.values(pkg.bin)) entries.add(value);
  }
  for (const value of Object.values(pkg.exports ?? {})) {
    if (typeof value === "string") entries.add(value);
    if (value && typeof value === "object") {
      for (const nested of Object.values(value)) {
        if (typeof nested === "string") entries.add(nested);
      }
    }
  }
  return [...entries].map((entry) => entry.replace(/^\.\//, ""));
}

const failures = [];

const rootLicense = await readFile(join(ROOT, "LICENSE"), "utf8").catch(() => null);
if (rootLicense === null) {
  failures.push("repository root is missing LICENSE");
}

for (const workspace of WORKSPACES) {
  const dir = join(ROOT, workspace);
  const pkgPath = join(dir, "package.json");
  const pkg = JSON.parse(await readFile(pkgPath, "utf8"));

  for (const file of REQUIRED) {
    try {
      await access(join(dir, file));
    } catch {
      failures.push(`${workspace} is missing ${file}`);
    }
  }

  const pkgLicense = await readFile(join(dir, "LICENSE"), "utf8").catch(() => null);
  if (pkgLicense !== null && rootLicense !== null && pkgLicense !== rootLicense) {
    failures.push(`${workspace}/LICENSE differs from the root LICENSE`);
  }

  const { stdout } = await run("npm", ["pack", "--dry-run", "--json"], { cwd: dir });
  const files = packFiles(JSON.parse(stdout));
  for (const file of REQUIRED) {
    if (!files.includes(file)) {
      failures.push(`${workspace} tarball does not ship ${file}`);
    }
  }
  for (const entry of declaredEntries(pkg)) {
    const stripped = entry.replace(/^\.\//, "");
    if (!files.some((file) => file === stripped || file.startsWith(`${stripped}/`))) {
      failures.push(`${workspace} tarball is missing declared entry ${entry}`);
    }
  }
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`check:packages: ${failure}`);
  process.exit(1);
}
console.log(`check:packages: ok (${WORKSPACES.join(", ")})`);
