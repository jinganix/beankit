#!/usr/bin/env sh
# Validates the first line of a git commit message (Conventional Commits).
# Rules mirror CONTRIBUTING.md: scope is `repo` or a directory under packages/.
set -e

COMMIT_MSG_FILE="${1:?usage: validate-commit-msg.sh <commit-msg-file>}"
HEADER=$(sed -n '1p' "$COMMIT_MSG_FILE")

# Merge commits
case "$HEADER" in
  Merge*) exit 0
esac

TYPES='feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert'
SCOPES='repo'
for d in packages/*/; do
  [ -d "$d" ] || continue
  SCOPES="$SCOPES|$(basename "$d")"
done
PATTERN="^(${TYPES})(\\((${SCOPES})\\))?: .+"

if ! printf '%s\n' "$HEADER" | grep -qE "$PATTERN"; then
  echo "commit-msg: invalid header — expected: <type>[(<scope>)]: <subject>"
  echo "  types:  feat fix docs style refactor perf test build ci chore revert"
  echo "  scopes: repo or a packages/* directory name (optional)"
  echo "  see CONTRIBUTING.md"
  exit 1
fi

if [ "${#HEADER}" -gt 100 ]; then
  echo "commit-msg: header exceeds 100 characters (${#HEADER})"
  exit 1
fi

exit 0
