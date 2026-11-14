#!/usr/bin/env bash
# Bring the compose files of a deployment up to date with a release, then
# recreate only the services whose configuration changed.
#
# Usage (from the deployment directory, e.g. /opt/allo-scrapper):
#   ./scripts/deploy-update.sh [--dry-run] [--yes] [--dir <path>] <tag>
#
# Examples:
#   ./scripts/deploy-update.sh --dry-run v4.10.0   # show what would change
#   ./scripts/deploy-update.sh v4.10.0             # apply (asks first)
#
# Why: Watchtower (and a plain `docker pull`) only swaps images. Each
# container keeps the config it was created with, so a new env var or any
# other change to docker-compose.yaml or deploy/docker-compose.prod.yml never
# reaches production on its own. Run this script on every release.
#
# What it does:
#   1. Downloads docker-compose.yaml from the tag, plus
#      deploy/docker-compose.prod.yml when the deployment uses that overlay.
#   2. Prints the diff against the installed files and lists the ${VARS} the
#      new files reference for the first time, saying whether .env sets them.
#   3. Validates the merged config against .env (`docker compose config`).
#   4. Lists the services whose running container differs from the new config
#      (compose config hash), plus containers the new config no longer defines.
#   5. Unless --dry-run: backs up the installed files to
#      .compose-backup/<timestamp>/, installs the new ones, and runs
#      `docker compose up -d --no-deps` on the changed services only.
#
# Options:
#   --dry-run    Show the plan, change nothing.
#   --yes        Do not ask for confirmation (needed when stdin is not a TTY).
#   --dir PATH   Deployment directory (default: current directory).
#
# Environment:
#   REPO_RAW_BASE  Where files are downloaded from, as <base>/<tag>/<path>.
#                  Default: https://raw.githubusercontent.com/PhBassin/allo-scrapper
#                  (a file:// URL works for local testing).
#
# Requires: bash, curl, diff, docker compose v2.17+. No other dependency.

set -euo pipefail

REPO_RAW_BASE="${REPO_RAW_BASE:-https://raw.githubusercontent.com/PhBassin/allo-scrapper}"
BASE_FILE="docker-compose.yaml"
PROD_FILE="deploy/docker-compose.prod.yml"
ENV_FILE=".env"

DRY_RUN=false
ASSUME_YES=false
DEPLOY_DIR="."
TAG=""

usage() {
    sed -n '2,10p' "$0" | sed 's/^# \{0,1\}//'
    exit "${1:-1}"
}

die() {
    echo "❌ $*" >&2
    exit 1
}

while [[ $# -gt 0 ]]; do
    case "$1" in
        --dry-run) DRY_RUN=true ;;
        --yes|-y) ASSUME_YES=true ;;
        --dir)
            [[ $# -ge 2 ]] || die "--dir needs a path"
            DEPLOY_DIR="$2"
            shift
            ;;
        -h|--help) usage 0 ;;
        -*) die "Unknown option: $1" ;;
        *)
            [[ -z "$TAG" ]] || die "Only one tag expected (got '$TAG' and '$1')"
            TAG="$1"
            ;;
    esac
    shift
done

[[ -n "$TAG" ]] || usage
[[ "$TAG" =~ ^[A-Za-z0-9._/-]+$ ]] || die "Invalid tag: $TAG"
if [[ ! "$TAG" =~ ^v[0-9]+\.[0-9]+\.[0-9]+$ ]]; then
    echo "⚠  '$TAG' is not a release tag (vX.Y.Z). Production should follow release tags only."
fi

cd "$DEPLOY_DIR" || die "Cannot cd into $DEPLOY_DIR"
[[ -f "$BASE_FILE" ]] || die "No $BASE_FILE in $(pwd). Run from the deployment directory or pass --dir."
[[ -f "$ENV_FILE" ]] || die "No $ENV_FILE in $(pwd)."

FILES=("$BASE_FILE")
if [[ -f "$PROD_FILE" ]]; then
    FILES+=("$PROD_FILE")
fi

# The new files are staged next to the installed ones (hidden, *.new) so that
# relative paths and the compose project name resolve exactly as they do live.
staged_path() {
    echo "$(dirname "$1")/.$(basename "$1").new"
}

LIVE_ARGS=()
NEW_ARGS=()
STAGED_FILES=()
for f in "${FILES[@]}"; do
    LIVE_ARGS+=(-f "$f")
    NEW_ARGS+=(-f "$(staged_path "$f")")
    STAGED_FILES+=("$(staged_path "$f")")
done

cleanup() { rm -f "${STAGED_FILES[@]}"; }
trap cleanup EXIT

live_compose() { docker compose "${LIVE_ARGS[@]}" --env-file "$ENV_FILE" "$@"; }
new_compose() { docker compose "${NEW_ARGS[@]}" --env-file "$ENV_FILE" "$@"; }

referenced_vars() {
    grep -ohE '\$\{[A-Za-z_][A-Za-z0-9_]*' "$@" | sed -E 's/^\$\{//' | sort -u || true
}

echo "📦 Fetching compose files for ${TAG} from ${REPO_RAW_BASE}"
for f in "${FILES[@]}"; do
    curl -fsSL "${REPO_RAW_BASE}/${TAG}/${f}" -o "$(staged_path "$f")" \
        || die "Cannot download ${f} at ${TAG}. Does the tag exist?"
done

# ---- 1. File diffs ---------------------------------------------------------
FILES_CHANGED=false
echo ""
for f in "${FILES[@]}"; do
    if diff -q "$f" "$(staged_path "$f")" > /dev/null; then
        echo "✓ ${f}: unchanged"
    else
        FILES_CHANGED=true
        echo "✎ ${f}: changed"
        diff -u --label "installed/${f}" --label "${TAG}/${f}" "$f" "$(staged_path "$f")" || true
    fi
done

# ---- 2. Newly referenced variables ----------------------------------------
NEW_VARS="$(comm -13 <(referenced_vars "${FILES[@]}") <(referenced_vars "${STAGED_FILES[@]}"))"
if [[ -n "$NEW_VARS" ]]; then
    echo ""
    echo "🔑 Variables referenced for the first time (check the release notes):"
    while IFS= read -r v; do
        if grep -qE "^[[:space:]]*(export[[:space:]]+)?${v}=" "$ENV_FILE"; then
            echo "   - ${v}: set in ${ENV_FILE}"
        elif grep -qE "\\\$\\{${v}:?\\?" "${STAGED_FILES[@]}"; then
            echo "   - ${v}: NOT set in ${ENV_FILE}, and required"
        else
            echo "   - ${v}: NOT set in ${ENV_FILE} (the compose default, or empty, applies)"
        fi
    done <<< "$NEW_VARS"
fi

# ---- 3. Validate the merged config ----------------------------------------
echo ""
if ! new_compose config -q; then
    die "The ${TAG} compose config does not validate against ${ENV_FILE} (see above). Fix ${ENV_FILE} and retry."
fi
echo "✓ ${TAG} compose config validates against ${ENV_FILE}"

# ---- 4. Services whose running container differs from the new config -----
declare -A RUNNING_HASH=()
while IFS= read -r id; do
    [[ -n "$id" ]] || continue
    read -r svc hash < <(docker inspect --format \
        '{{index .Config.Labels "com.docker.compose.service"}} {{index .Config.Labels "com.docker.compose.config-hash"}}' "$id")
    RUNNING_HASH["$svc"]="$hash"
done < <(live_compose ps -a -q)

PROJECT="$(live_compose config 2>/dev/null | sed -n 's/^name: //p' | head -n 1)"
if [[ ${#RUNNING_HASH[@]} -eq 0 ]]; then
    echo ""
    echo "⚠  No container found for compose project '${PROJECT}'. If the stack runs under"
    echo "   another project name, set COMPOSE_PROJECT_NAME (in ${ENV_FILE} or the shell)."
    if [[ "$DRY_RUN" != true ]]; then
        die "Refusing to apply: it would start a second copy of the stack. Start it first with docker compose up -d."
    fi
fi

declare -A NEW_HASH=()
CHANGED=()
while read -r svc hash; do
    [[ -n "$svc" ]] || continue
    NEW_HASH["$svc"]="$hash"
    if [[ "${RUNNING_HASH[$svc]:-}" != "$hash" ]]; then
        CHANGED+=("$svc")
    fi
done < <(new_compose config --hash '*')

ORPHANS=()
for svc in "${!RUNNING_HASH[@]}"; do
    [[ -n "${NEW_HASH[$svc]:-}" ]] || ORPHANS+=("$svc")
done

echo ""
if [[ ${#CHANGED[@]} -eq 0 ]]; then
    echo "✓ Every running service already matches the ${TAG} config"
else
    echo "🔁 Services to recreate (config differs from the running container):"
    for svc in "${CHANGED[@]}"; do
        if [[ -n "${RUNNING_HASH[$svc]:-}" ]]; then
            echo "   - ${svc}"
        else
            echo "   - ${svc} (new, not running yet)"
        fi
    done
fi
if [[ ${#ORPHANS[@]} -gt 0 ]]; then
    echo "⚠  Containers no longer defined in ${TAG}: ${ORPHANS[*]}"
    echo "   Remove them yourself once you have checked: docker compose ... up -d --remove-orphans"
fi

if [[ "$FILES_CHANGED" == false && ${#CHANGED[@]} -eq 0 ]]; then
    echo ""
    echo "✅ Nothing to do."
    exit 0
fi

if [[ "$DRY_RUN" == true ]]; then
    echo ""
    echo "ℹ️  Dry run: nothing was changed. Re-run without --dry-run to apply."
    exit 0
fi

# ---- 5. Apply ---------------------------------------------------------------
if [[ "$ASSUME_YES" != true ]]; then
    [[ -t 0 ]] || die "stdin is not a terminal: pass --yes to apply without confirmation."
    echo ""
    read -r -p "Install the ${TAG} compose files and recreate the services above? [y/N] " reply
    [[ "$reply" =~ ^[Yy]$ ]] || { echo "Aborted, nothing changed."; exit 1; }
fi

if [[ "$FILES_CHANGED" == true ]]; then
    BACKUP_DIR=".compose-backup/$(date +%Y%m%d-%H%M%S)"
    mkdir -p "$BACKUP_DIR"
    for f in "${FILES[@]}"; do
        mkdir -p "${BACKUP_DIR}/$(dirname "$f")"
        cp -p "$f" "${BACKUP_DIR}/${f}"
        # Keep the installed file's mode; only its content changes.
        cat "$(staged_path "$f")" > "$f"
    done
    echo "💾 Previous files saved in ${BACKUP_DIR}/"
    echo "✓ Installed the ${TAG} compose files"
fi

if [[ ${#CHANGED[@]} -gt 0 ]]; then
    echo "🚀 Recreating: ${CHANGED[*]}"
    live_compose up -d --no-deps "${CHANGED[@]}"
    echo ""
    live_compose ps
fi

echo ""
echo "✅ Deployment config is at ${TAG}."
