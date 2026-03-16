#!/bin/bash
# Generate changelog entry from git commits
# Usage: ./generate-changelog.sh <from-ref> <to-ref>

set -euo pipefail

FROM_REF="${1:-}"
TO_REF="${2:-HEAD}"

if [ -z "$FROM_REF" ]; then
  echo "Usage: $0 <from-ref> <to-ref>"
  echo "Example: $0 v4.0.0 HEAD"
  exit 1
fi

# Get commits between references
# Format: hash|subject (body removed to avoid noise)
COMMITS=$(git log --pretty=format:"%h|%s" "${FROM_REF}..${TO_REF}" 2>/dev/null || echo "")

if [ -z "$COMMITS" ]; then
  echo "### Changed"
  echo ""
  echo "- No notable changes"
  exit 0
fi

# Arrays to hold categorized commits
declare -a ADDED=()
declare -a CHANGED=()
declare -a FIXED=()
declare -a SECURITY=()
declare -a DEPRECATED=()
declare -a REMOVED=()
declare -a PERFORMANCE=()
declare -a DOCS=()
declare -a CHORE=()
declare -a BREAKING=()

# Parse commits and categorize
while IFS='|' read -r HASH SUBJECT; do
  # Skip version bump commits from this workflow
  if echo "$SUBJECT" | grep -q "chore(release): bump version"; then
    continue
  fi
  
  # Categorize by conventional commit type
  if echo "$SUBJECT" | grep -qE "^feat(\(|:)"; then
    ADDED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^fix(\(|:)"; then
    FIXED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^security(\(|:)"; then
    SECURITY+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^perf(\(|:)"; then
    PERFORMANCE+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^refactor(\(|:)"; then
    CHANGED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^style(\(|:)"; then
    CHANGED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^docs(\(|:)"; then
    DOCS+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^test(\(|:)"; then
    CHANGED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^build(\(|:)"; then
    CHORE+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^ci(\(|:)"; then
    CHORE+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^chore(\(|:)"; then
    CHORE+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^(remove|deprecated)(\(|:)"; then
    REMOVED+=("- ${SUBJECT} (${HASH})")
  elif echo "$SUBJECT" | grep -qiE "(BREAKING CHANGE:|\\[major\\])"; then
    BREAKING+=("⚠️ BREAKING: ${SUBJECT} (${HASH})")
  else
    # Default: treat as changed
    CHANGED+=("- ${SUBJECT} (${HASH})")
  fi
done <<< "$COMMITS"

# Output formatted changelog sections

# Breaking changes first (if any)
if [ ${#BREAKING[@]} -gt 0 ]; then
  echo "### ⚠️ Breaking Changes"
  echo ""
  printf '%s\n' "${BREAKING[@]}"
  echo ""
fi

# Added (features)
if [ ${#ADDED[@]} -gt 0 ]; then
  echo "### Added"
  echo ""
  printf '%s\n' "${ADDED[@]}"
  echo ""
fi

# Fixed (bug fixes)
if [ ${#FIXED[@]} -gt 0 ]; then
  echo "### Fixed"
  echo ""
  printf '%s\n' "${FIXED[@]}"
  echo ""
fi

# Changed (refactors, styles, tests)
if [ ${#CHANGED[@]} -gt 0 ]; then
  echo "### Changed"
  echo ""
  printf '%s\n' "${CHANGED[@]}"
  echo ""
fi

# Security
if [ ${#SECURITY[@]} -gt 0 ]; then
  echo "### Security"
  echo ""
  printf '%s\n' "${SECURITY[@]}"
  echo ""
fi

# Performance
if [ ${#PERFORMANCE[@]} -gt 0 ]; then
  echo "### Performance"
  echo ""
  printf '%s\n' "${PERFORMANCE[@]}"
  echo ""
fi

# Deprecated
if [ ${#DEPRECATED[@]} -gt 0 ]; then
  echo "### Deprecated"
  echo ""
  printf '%s\n' "${DEPRECATED[@]}"
  echo ""
fi

# Removed
if [ ${#REMOVED[@]} -gt 0 ]; then
  echo "### Removed"
  echo ""
  printf '%s\n' "${REMOVED[@]}"
  echo ""
fi

# Documentation
if [ ${#DOCS[@]} -gt 0 ]; then
  echo "### Documentation"
  echo ""
  printf '%s\n' "${DOCS[@]}"
  echo ""
fi

# Chore (build, ci, etc.)
if [ ${#CHORE[@]} -gt 0 ]; then
  echo "### Maintenance"
  echo ""
  printf '%s\n' "${CHORE[@]}"
  echo ""
fi

# If no categorized commits at all, show generic message
TOTAL_COMMITS=$((${#ADDED[@]} + ${#FIXED[@]} + ${#CHANGED[@]} + ${#SECURITY[@]} + ${#DEPRECATED[@]} + ${#REMOVED[@]} + ${#PERFORMANCE[@]} + ${#DOCS[@]} + ${#CHORE[@]} + ${#BREAKING[@]}))

if [ $TOTAL_COMMITS -eq 0 ]; then
  echo "### Changed"
  echo ""
  echo "- Miscellaneous updates and improvements"
fi
