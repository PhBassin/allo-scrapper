#!/usr/bin/env bash
set -euo pipefail

# Script to delete untagged Docker images from GHCR in batch
# Targets both 'allo-scrapper' and 'allo-scrapper-scraper' packages

OWNER="PhBassin"
REPO="allo-scrapper"
PACKAGES=("allo-scrapper" "allo-scrapper-scraper")
PARALLEL_JOBS=10

# Default flags
DRY_RUN=false
FORCE=false
LIMIT=0

# Help message
usage() {
    echo "Usage: $0 [options]"
    echo ""
    echo "Options:"
    echo "  --dry-run      Show what would be deleted without actually deleting"
    echo "  --force, -y    Skip confirmation prompt"
    echo "  --limit <n>    Limit the number of images to process (0 for all)"
    echo "  --help         Show this help message"
    echo ""
    exit 0
}

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        --dry-run)
            DRY_RUN=true
            shift
            ;;
        --force|-y)
            FORCE=true
            shift
            ;;
        --limit=*)
            LIMIT="${1#*=}"
            shift
            ;;
        --limit)
            LIMIT="$2"
            shift 2
            ;;
        --help)
            usage
            ;;
        *)
            echo "Unknown option: $1"
            usage
            ;;
    esac
done

# Validate limit
if ! [[ "$LIMIT" =~ ^[0-9]+$ ]]; then
    echo "Error: --limit must be a non-negative integer"
    exit 1
fi

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 GHCR Untagged Image Batch Cleanup${NC}"
echo -e "${BLUE}Owner: ${OWNER}${NC}"
echo -e "${BLUE}Repo: ${REPO}${NC}"
if [ "$LIMIT" -gt 0 ]; then
    echo -e "${BLUE}Limit: First ${LIMIT} images per package${NC}"
fi
if [ "$DRY_RUN" = true ]; then
    echo -e "${YELLOW}⚠️  DRY RUN MODE: No images will be deleted${NC}"
fi
echo ""

# Check prerequisites
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
    exit 1
fi

if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is not installed${NC}"
    exit 1
fi

if ! command -v xargs &> /dev/null; then
    echo -e "${RED}❌ Error: xargs is not installed${NC}"
    exit 1
fi

# Function to delete a single version (called by xargs)
# Note: Functions are not exported to xargs subshells easily, so we use a separate small script or direct command in xargs
# tailored for xargs: gh api -X DELETE ...

# Function to clean a specific package
clean_package() {
    local PACKAGE=$1
    echo -e "${YELLOW}📦 Analyzing package: ${PACKAGE}...${NC}"

    # Fetch all versions (paginated)
    # We use a temporary file to store versions because the list can be long
    TMP_VERSIONS=$(mktemp)
    
    echo -e "   Fetching versions..."
    gh api "orgs/${OWNER}/packages/container/${PACKAGE}/versions?per_page=100" --paginate > "$TMP_VERSIONS" 2>/dev/null || \
    gh api "users/${OWNER}/packages/container/${PACKAGE}/versions?per_page=100" --paginate > "$TMP_VERSIONS" 2>/dev/null || \
    echo "[]" > "$TMP_VERSIONS"

    if [[ ! -s "$TMP_VERSIONS" || "$(cat "$TMP_VERSIONS")" == "[]" ]]; then
        echo -e "${BLUE}   No versions found for ${PACKAGE}.${NC}"
        rm -f "$TMP_VERSIONS"
        return
    fi

    # Filter versions
    # We identify two types:
    # 1. Untagged: tags is empty or null
    # 2. SHA-only: tags is not empty, but ALL tags start with "sha"
    
    # We use jq to output CSV: "ID,TYPE"
    # Then we parse it in bash
    
    TMP_IDS=$(mktemp)
    
    # Using jq to classify each version
    # Note: select(...) | ... outputs ID,TYPE
    jq -r '
        .[] | 
        if ((.metadata.container.tags // []) | length == 0) then 
            (.id | tostring) + ",UNTAGGED"
        elif (all(.metadata.container.tags[]; startswith("sha"))) then
            (.id | tostring) + ",SHA_ONLY"
        else 
            empty 
        end
    ' "$TMP_VERSIONS" > "$TMP_IDS"

    TOTAL_COUNT=$(wc -l < "$TMP_IDS" | tr -d ' ')

    if [[ "$TOTAL_COUNT" -eq 0 ]]; then
        echo -e "${GREEN}   ✅ No cleanup needed (no untagged or SHA-only versions).${NC}"
        rm -f "$TMP_VERSIONS" "$TMP_IDS"
        return
    fi
    
    # Apply limit if set (strictly on the total list)
    if [ "$LIMIT" -gt 0 ]; then
        head -n "$LIMIT" "$TMP_IDS" > "${TMP_IDS}.limited"
        mv "${TMP_IDS}.limited" "$TMP_IDS"
        TOTAL_COUNT=$(wc -l < "$TMP_IDS" | tr -d ' ')
    fi

    # Count categories after limit
    COUNT_UNTAGGED=$(grep -c ",UNTAGGED" "$TMP_IDS" || true)
    COUNT_SHA=$(grep -c ",SHA_ONLY" "$TMP_IDS" || true)

    echo -e "${RED}   ⚠️  Found ${TOTAL_COUNT} candidates for deletion:${NC}"
    echo -e "      - ${YELLOW}${COUNT_UNTAGGED}${NC} Untagged images"
    echo -e "      - ${YELLOW}${COUNT_SHA}${NC} SHA-only images (all tags start with 'sha')"
    
    # Extract just IDs for processing
    cut -d',' -f1 "$TMP_IDS" > "${TMP_VERSIONS}.ids"
    
    # Dry run output
    if [ "$DRY_RUN" = true ]; then
        echo -e "${YELLOW}   [DRY-RUN] Would delete ${TOTAL_COUNT} images.${NC}"
        echo -e "   Sample IDs:"
        head -n 5 "${TMP_VERSIONS}.ids" | sed 's/^/      - /'
        rm -f "$TMP_VERSIONS" "$TMP_IDS" "${TMP_VERSIONS}.ids"
        return
    fi

    # Confirmation
    if [ "$FORCE" = false ]; then
        echo ""
        read -p "   🔥 Delete these ${TOTAL_COUNT} images for ${PACKAGE}? [y/N] " -n 1 -r
        echo ""
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            echo -e "${BLUE}   ❌ Skipped.${NC}"
            rm -f "$TMP_VERSIONS" "$TMP_IDS" "${TMP_VERSIONS}.ids"
            return
        fi
    fi

    # Batch Deletion
    echo -e "${YELLOW}   🚀 Deleting ${TOTAL_COUNT} images in parallel (${PARALLEL_JOBS} threads)...${NC}"
    
    # We construct the API endpoint dynamically for xargs
    # Trying orgs endpoint first, it usually redirects or works for both if owner is org
    # If owner is user, we might need users/ endpoint. 
    # To be safe, we'll try the one that worked for fetching, but for deletion we'll assume the same scope.
    # Let's check which endpoint type works by checking the versions URL or just trying.
    # A robust way is to use 'gh api -X DELETE "users/${OWNER}/packages/container/${PACKAGE}/versions/{}"'
    
    # Determine the correct endpoint prefix based on the earlier fetch success would be better, but
    # gh api is smart enough to handle user vs org mostly.
    # However, for deletion, we need the exact path.
    # Let's try to detect if it's an org or user from the first fetch output if possible, or just default to users if fetch failed on orgs.
    # Actually, the user script had a try/catch block. 
    # For xargs, we can't easily do try/catch.
    # Let's define a helper command string.
    
    ENDPOINT_BASE="users/${OWNER}"
    # check if owner is org
    TYPE=$(gh api "users/${OWNER}" --jq '.type' 2>/dev/null || echo "User")
    if [[ "$TYPE" == "Organization" ]]; then
        ENDPOINT_BASE="orgs/${OWNER}"
    fi

    echo -e "   Using endpoint base: ${ENDPOINT_BASE}"

    # Export for xargs
    export ENDPOINT_BASE
    export PACKAGE
    
    # Prepare the command for xargs
    # We use 'gh api -X DELETE'
    # We use -I {} to replace the ID
    
    # We use double quotes for the bash command string so variables are expanded by the parent shell
    # This avoids issues with exporting variables to subshells
    cat "${TMP_VERSIONS}.ids" | xargs -P "$PARALLEL_JOBS" -I {} bash -c "if gh api -X DELETE \"${ENDPOINT_BASE}/packages/container/${PACKAGE}/versions/{}\" >/dev/null 2>&1; then echo \"✅ Deleted {}\"; else echo \"❌ Failed {}\"; fi"

    echo -e "${GREEN}   ✨ Batch operation complete.${NC}"
    echo ""
    
    rm -f "$TMP_VERSIONS" "${TMP_VERSIONS}.ids"
}

# Main loop
for pkg in "${PACKAGES[@]}"; do
    clean_package "$pkg"
done

echo -e "${BLUE}All operations completed.${NC}"
