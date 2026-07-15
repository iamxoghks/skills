#!/usr/bin/env bash
set -euo pipefail

force="false"
if [[ "${1:-}" == "--force" ]]; then
  force="true"
elif [[ $# -gt 0 ]]; then
  echo "Usage: $0 [--force]" >&2
  exit 2
fi

script_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
repo_root="$(cd "$script_dir/.." && pwd)"
source_dir="$repo_root/storyboard-builder"
codex_home="${CODEX_HOME:-$HOME/.codex}"
destination="$codex_home/skills/storyboard-builder"

if [[ ! -f "$source_dir/SKILL.md" ]]; then
  echo "Error: skill source not found: $source_dir" >&2
  exit 2
fi

if [[ -e "$destination" ]]; then
  if [[ "$force" != "true" ]]; then
    echo "Error: skill already exists: $destination" >&2
    echo "Run with --force to replace it." >&2
    exit 2
  fi
  rm -rf "$destination"
fi

mkdir -p "$(dirname "$destination")"
cp -R "$source_dir" "$destination"
echo "Installed: $destination"
