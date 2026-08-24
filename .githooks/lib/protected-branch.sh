#!/bin/bash
# Shared guard: block commits on protected integration branches.
# Sourced by .githooks/pre-commit and .cursor/hooks/block-protected-git-commit.sh

# Space-separated branch names. Override with PROTECTED_GIT_BRANCHES env.
DEFAULT_PROTECTED_GIT_BRANCHES="main master develop production"

protected_branch_list() {
  echo "${PROTECTED_GIT_BRANCHES:-$DEFAULT_PROTECTED_GIT_BRANCHES}"
}

is_protected_branch() {
  local branch="$1"
  local protected
  for protected in $(protected_branch_list); do
    if [ "$branch" = "$protected" ]; then
      return 0
    fi
  done
  return 1
}

# Exit 0 when commit is allowed, 1 when blocked.
# Args: optional repo path (defaults to current directory).
check_protected_branch_commit() {
  local repo_path="${1:-.}"

  if [ "${ALLOW_PROTECTED_BRANCH_COMMIT:-}" = "1" ]; then
    return 0
  fi

  if ! git -C "$repo_path" rev-parse --git-dir >/dev/null 2>&1; then
    return 0
  fi

  local branch
  branch="$(git -C "$repo_path" branch --show-current 2>/dev/null || true)"
  if [ -z "$branch" ]; then
    # Detached HEAD (cherry-pick, rebase, CI) — do not block.
    return 0
  fi

  if is_protected_branch "$branch"; then
    local repo_name
    repo_name="$(basename "$(git -C "$repo_path" rev-parse --show-toplevel 2>/dev/null || echo "$repo_path")")"
    echo "Refusing to commit on protected branch '$branch' in $repo_name." >&2
    echo "Create a feature branch first, e.g. git checkout -b feature/your-slice" >&2
    echo "Emergency override: ALLOW_PROTECTED_BRANCH_COMMIT=1 git commit ..." >&2
    return 1
  fi

  return 0
}

# Parse a shell git command and return the repo path to inspect.
# Prints one path per matching git -C flag, or "." when cwd should be used.
extract_git_repo_paths_from_command() {
  local command="$1"
  local token after_c=0

  if ! printf '%s' "$command" | grep -qE '(^|[[:space:]])git([[:space:]]|$)'; then
    return 0
  fi

  if ! printf '%s' "$command" | grep -qE '(^|[[:space:]])commit([[:space:]]|$)'; then
    return 0
  fi

  # shellcheck disable=SC2086
  for token in $command; do
    if [ "$after_c" = "1" ]; then
      printf '%s\n' "$token"
      after_c=0
      continue
    fi
    if [ "$token" = "-C" ]; then
      after_c=1
    fi
  done

  # No explicit -C: caller should check workspace cwd.
  if [ "$after_c" = "0" ]; then
    printf '%s\n' "."
  fi
}
