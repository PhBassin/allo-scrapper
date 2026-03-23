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

# Check if bot commit (for filtering)
is_bot_commit() {
  local author="$1"
  case "$author" in
    *"[bot]"|*"bot@"*|"dependabot"*|"github-actions"*)
      return 0  # is bot
      ;;
    *)
      return 1  # not bot
      ;;
  esac
}

# Extract GitHub username from author info
get_github_username() {
  local author="$1"
  local email="$2"
  
  # Try to extract from email (user@users.noreply.github.com or number+user@users.noreply.github.com)
  if [[ "$email" =~ ^[0-9]*\+?([^@]+)@users\.noreply\.github\.com$ ]]; then
    echo "${BASH_REMATCH[1]}"
  else
    # Fall back to author name (lowercase, no spaces)
    echo "$author" | tr '[:upper:]' '[:lower:]' | tr -d ' '
  fi
}

# Get commits between references (subject only, no body)
# Format: hash|author|email|subject
COMMITS=$(git log --pretty=format:"%h|%an|%ae|%s" "${FROM_REF}..${TO_REF}" 2>/dev/null || echo "")

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
while IFS='|' read -r HASH AUTHOR EMAIL SUBJECT; do
  # Skip empty lines
  [ -z "$HASH" ] && continue
  
  # Skip version bump commits from this workflow
  if echo "$SUBJECT" | grep -q "chore(release): bump version"; then
    continue
  fi
  
  # Skip bot commits
  if is_bot_commit "$AUTHOR"; then
    continue
  fi
  
  # Get GitHub username and create contributor link
  GITHUB_USER=$(get_github_username "$AUTHOR" "$EMAIL")
  CONTRIBUTOR_LINK="[@${GITHUB_USER}](https://github.com/${GITHUB_USER})"
  
  # Categorize by conventional commit type
  if echo "$SUBJECT" | grep -qE "^feat(\(|:)"; then
    ADDED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^fix(\(|:)"; then
    FIXED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^security(\(|:)"; then
    SECURITY+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^perf(\(|:)"; then
    PERFORMANCE+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^refactor(\(|:)"; then
    CHANGED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^style(\(|:)"; then
    CHANGED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^docs(\(|:)"; then
    DOCS+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^test(\(|:)"; then
    CHANGED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^build(\(|:)"; then
    CHORE+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^ci(\(|:)"; then
    CHORE+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^chore(\(|:)"; then
    CHORE+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qE "^(remove|deprecated)(\(|:)"; then
    REMOVED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
  elif echo "$SUBJECT" | grep -qiE "(BREAKING CHANGE:|\\[major\\])"; then
    # For breaking changes, fetch the body separately
    BODY=$(git log --format=%b -n 1 "$HASH")
    
    # Check if body contains BREAKING CHANGE details
    if echo "$BODY" | grep -q "BREAKING CHANGE:"; then
      # Extract everything after "BREAKING CHANGE:" until empty line
      BREAKING_DETAILS=$(echo "$BODY" | sed -n '/BREAKING CHANGE:/,/^$/p' | tail -n +2 | sed '/^$/d')
      if [ -n "$BREAKING_DETAILS" ]; then
        BREAKING+=("⚠️ **${SUBJECT}** ${CONTRIBUTOR_LINK} (${HASH})")
        # Add indented details
        while IFS= read -r line; do
          [ -n "$line" ] && BREAKING+=("  - ${line}")
        done <<< "$BREAKING_DETAILS"
      else
        BREAKING+=("⚠️ BREAKING: ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
      fi
    else
      BREAKING+=("⚠️ BREAKING: ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
    fi
  else
    # Default: treat as changed
    CHANGED+=("- ${SUBJECT} ${CONTRIBUTOR_LINK} (${HASH})")
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
