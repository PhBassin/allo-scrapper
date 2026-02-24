#!/usr/bin/env bash
set -euo pipefail

# Docker Image Cleanup Script for GitHub Container Registry
# Keeps the N most recent image versions, deletes older untagged/sha256 versions
# Protects important tags: latest, stable, develop, main, v*, pr-*

REGISTRY="ghcr.io"
OWNER="PhBassin"
REPO="allo-scrapper"
PACKAGE="allo-scrapper"
KEEP_VERSIONS=30  # Number of recent versions to keep

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Docker Image Cleanup Script${NC}"
echo -e "${BLUE}Registry: ${REGISTRY}/${OWNER}/${REPO}${NC}"
echo -e "${BLUE}Package: ${PACKAGE}${NC}"
echo -e "${BLUE}Keep: ${KEEP_VERSIONS} most recent versions${NC}"
echo ""

# Check if gh CLI is installed
if ! command -v gh &> /dev/null; then
    echo -e "${RED}❌ Error: GitHub CLI (gh) is not installed${NC}"
    echo "Install it: https://cli.github.com/"
    exit 1
fi

# Check if jq is installed
if ! command -v jq &> /dev/null; then
    echo -e "${RED}❌ Error: jq is not installed${NC}"
    echo "Install it: sudo apt-get install jq"
    exit 1
fi

# Fetch all package versions
echo -e "${YELLOW}📦 Fetching package versions...${NC}"
VERSIONS_JSON=$(gh api "repos/${OWNER}/${REPO}/packages/container/${PACKAGE}/versions?per_page=100" --paginate 2>/dev/null)

if [[ -z "$VERSIONS_JSON" || "$VERSIONS_JSON" == "[]" ]]; then
    echo -e "${RED}❌ No versions found or unable to fetch. Check your permissions.${NC}"
    exit 1
fi

# Count total versions
TOTAL_VERSIONS=$(echo "$VERSIONS_JSON" | jq '. | length')
echo -e "${GREEN}✅ Found ${TOTAL_VERSIONS} versions${NC}"
echo ""

# Protected tags (never delete)
PROTECTED_TAGS=("latest" "stable" "develop" "main")

# Function to check if version should be protected
is_protected() {
    local tags="$1"
    
    # Check if tags contain protected keywords
    for tag in "${PROTECTED_TAGS[@]}"; do
        if echo "$tags" | jq -e --arg tag "$tag" '. | any(. == $tag)' > /dev/null 2>&1; then
            return 0  # Protected
        fi
    done
    
    # Protect version tags (v*.*.*)
    if echo "$tags" | jq -e '. | any(test("^v[0-9]+\\.[0-9]+"))' > /dev/null 2>&1; then
        return 0  # Protected
    fi
    
    # Protect recent PR tags (keep last 10 PRs)
    if echo "$tags" | jq -e '. | any(test("^pr-[0-9]+$"))' > /dev/null 2>&1; then
        return 0  # Protected (for now - can adjust logic)
    fi
    
    return 1  # Not protected
}

echo -e "${YELLOW}🔍 Analyzing versions to delete...${NC}"
echo ""

# Get versions older than KEEP_VERSIONS
VERSIONS_TO_CHECK=$(echo "$VERSIONS_JSON" | jq -r '
  sort_by(.created_at) | reverse | .['"$KEEP_VERSIONS"':] | .[] | 
  {id: .id, tags: .metadata.container.tags, created_at: .created_at}
')

if [[ -z "$VERSIONS_TO_CHECK" ]]; then
    echo -e "${GREEN}✅ Only ${TOTAL_VERSIONS} versions found (keeping ${KEEP_VERSIONS}). Nothing to delete.${NC}"
    exit 0
fi

# Count deletable versions
DELETABLE=0
echo "$VERSIONS_TO_CHECK" | jq -c '.' | while IFS= read -r version; do
    VERSION_ID=$(echo "$version" | jq -r '.id')
    TAGS=$(echo "$version" | jq -r '.tags // []')
    CREATED_AT=$(echo "$version" | jq -r '.created_at')
    
    # Display tag info
    if [[ "$TAGS" == "[]" || "$TAGS" == "null" ]]; then
        TAG_DISPLAY="(untagged)"
    else
        TAG_DISPLAY=$(echo "$TAGS" | jq -r 'join(", ")')
    fi
    
    # Check if protected
    if is_protected "$TAGS"; then
        echo -e "${BLUE}⚠️  SKIP (protected): ${TAG_DISPLAY} | Created: ${CREATED_AT}${NC}"
    else
        echo -e "${YELLOW}🗑️  DELETE: ${TAG_DISPLAY} | Created: ${CREATED_AT} | ID: ${VERSION_ID}${NC}"
        ((DELETABLE++)) || true
    fi
done

echo ""
echo -e "${YELLOW}📊 Summary:${NC}"
echo -e "  Total versions: ${TOTAL_VERSIONS}"
echo -e "  Keeping: ${KEEP_VERSIONS} most recent"
echo -e "  Deletable: ~${DELETABLE}"
echo ""

# Ask for confirmation
read -p "$(echo -e ${RED}Do you want to proceed with deletion? [y/N]:${NC} )" -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo -e "${BLUE}❌ Cancelled by user${NC}"
    exit 0
fi

echo ""
echo -e "${YELLOW}🗑️  Starting deletion...${NC}"

# Delete versions
DELETED=0
echo "$VERSIONS_TO_CHECK" | jq -c '.' | while IFS= read -r version; do
    VERSION_ID=$(echo "$version" | jq -r '.id')
    TAGS=$(echo "$version" | jq -r '.tags // []')
    
    if ! is_protected "$TAGS"; then
        echo -e "${YELLOW}Deleting version ID ${VERSION_ID}...${NC}"
        if gh api -X DELETE "repos/${OWNER}/${REPO}/packages/container/${PACKAGE}/versions/${VERSION_ID}" 2>/dev/null; then
            echo -e "${GREEN}✅ Deleted${NC}"
            ((DELETED++)) || true
        else
            echo -e "${RED}❌ Failed to delete${NC}"
        fi
    fi
done

echo ""
echo -e "${GREEN}✅ Cleanup complete!${NC}"
echo -e "${GREEN}Deleted ${DELETED} old versions${NC}"
