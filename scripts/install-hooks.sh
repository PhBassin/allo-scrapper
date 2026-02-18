#!/bin/sh
# install-hooks.sh — install local git hooks for this repository
# Run once after cloning: ./scripts/install-hooks.sh

set -e

REPO_ROOT="$(git rev-parse --show-toplevel)"
HOOKS_DIR="$REPO_ROOT/.git/hooks"
SOURCE_DIR="$REPO_ROOT/scripts/hooks"

echo "Installing git hooks from $SOURCE_DIR into $HOOKS_DIR..."

for hook in "$SOURCE_DIR"/*; do
  name="$(basename "$hook")"
  dest="$HOOKS_DIR/$name"
  cp "$hook" "$dest"
  chmod +x "$dest"
  echo "  installed: $name"
done

echo "Done. Git hooks installed successfully."
