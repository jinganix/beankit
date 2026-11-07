# Agents

Guidance for automated contributions to `beankit`.

## Read this first

- Monorepo layout: root `package.json` (`workspaces: packages/*`) plus one folder per
  package under `packages/`. Every package is independently publishable to npm.
- Toolchain (mirrors `subconverter-ts`, minus nx/knip): `tsup` (build), `vitest` (test),
  `tsc` (types), `eslint` + `prettier` (style).

## Commands

Run from the repo root:

| Task         | Command                                    |
| ------------ | ------------------------------------------ |
| Install      | `npm install`                              |
| Build        | `npm run build`                            |
| Typecheck    | `npm run typecheck`                        |
| Lint         | `npm run lint`                             |
| Lint (fix)   | `npm run lint:fix`                         |
| Format       | `npm run format`                           |
| Format check | `npm run format:check`                     |
| Test         | `npm test`                                 |
| Coverage     | `npm run test:coverage -w packages/<name>` |
| Check        | `npm run check`                            |
| Packages     | `npm run check:packages`                   |

Before committing: `npm run check` (typecheck + lint + format + test across all workspaces)
must be green. The `.githooks/pre-commit` and `pre-push` hooks run the same gate via
`scripts/check.sh`; enable them once per clone with
`./scripts/setup-git-hooks.sh`. Direct commits and pushes to `master` are blocked —
work on a branch. Commit messages follow [CONTRIBUTING.md](CONTRIBUTING.md)
(Conventional Commits, enforced by the `commit-msg` hook).

## Conventions

- TypeScript strict; `verbatimModuleSyntax`; `consistent-type-imports` (inline `type`).
- Imports are **extensionless** (`moduleResolution: Bundler`).
- Re-exports are only allowed in package entry points (`src/index.ts`, and the
  `src/bigint.ts` subpath) — the public API barrel.
- `max-len` 100; Prettier owns formatting.
- Tests live next to sources as `*.test.ts` (vitest).

## Testing requirements

- **100% coverage is mandatory**: every package sets vitest coverage thresholds
  (lines/branches/functions/statements) to 100. No new code without full-branch tests.
- Add regression tests for every bug fix.
- New package checklist: `package.json`, `tsconfig.{app,node}.json`, `tsup.config.ts`,
  `vitest.config.ts` (100% thresholds), `eslint.config.js`, `README.md`, `LICENSE`,
  entry in root README table.
