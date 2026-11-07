# Contributing to beankit

## Commit messages (Conventional Commits)

Format:

```
<type>(<scope>): <subject>
```

- **subject**: imperative mood, short; header must be ≤ 100 characters.
- **scope**: the package name (`url-join`, ...) or `repo` for root-level changes.

| type       | When to use                                   |
| ---------- | --------------------------------------------- |
| `feat`     | New feature or new package.                   |
| `fix`      | Bug fix.                                      |
| `docs`     | Documentation only.                           |
| `style`    | Formatting, no semantic change.               |
| `refactor` | Structural change without external behavior.  |
| `perf`     | Performance work.                             |
| `test`     | Tests only.                                   |
| `build`    | Build tooling, tsconfig, tsup, deps versions. |
| `ci`       | CI, gate scripts.                             |
| `chore`    | Maintenance that fits nothing above.          |
| `revert`   | Revert a previous commit.                     |

Examples:

```
feat(url-join): add hashbang-aware joining

fix(repo): correct engines field
```

## Local validation (shell hooks)

Run once after cloning or when hooks change:

```bash
./scripts/setup-git-hooks.sh
```

Try the message validator directly:

```bash
echo "feat(url-join): test message" | ./scripts/validate-commit-msg.sh /dev/stdin
```

**Commit/push gate**: `pre-commit` and `pre-push` both run `scripts/check.sh`,
which installs dependencies if needed and runs `npm run check`
(typecheck + lint + format + tests across all workspaces). Direct commits and pushes to
`master` are blocked — work on a branch:

```bash
./scripts/check.sh              # the same gate, manually
SKIP_CHECKS=1 ./scripts/check.sh  # emergency bypass (real reason only)
```

New code must keep 100% test coverage (vitest thresholds enforce it).
