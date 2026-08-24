#!/bin/bash
# Activate this repo's committed pre-commit hook (run from repo root or via path).
set -euo pipefail
export PATH="/usr/bin:/bin:/opt/homebrew/bin:${PATH:-}"

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
git -C "$REPO_ROOT" config core.hooksPath .githooks
echo "core.hooksPath -> .githooks ($(basename "$REPO_ROOT"))"
echo "Blocked branches: ${PROTECTED_GIT_BRANCHES:-main master develop production}"
