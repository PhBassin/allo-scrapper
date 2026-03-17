#!/usr/bin/env bash
set -e

# Post-Merge Cleanup Script
# Safely returns to develop, updates dependencies, and cleans up merged branches.

# Color codes
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🧹 Post-Merge Cleanup Specialist${NC}"
echo "=================================="

# Step 1: Pre-flight Safety Checks
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)

# Check 1: Not on develop or main
if [[ "$CURRENT_BRANCH" == "develop" || "$CURRENT_BRANCH" == "main" ]]; then
    echo -e "${YELLOW}ℹ️  You're already on the '$CURRENT_BRANCH' branch.${NC}"
    echo ""
    echo "What would you like to do?"
    echo "1. Pull latest changes (git pull origin $CURRENT_BRANCH)"
    echo "2. List and clean up merged branches"
    echo "3. Cancel"
    echo ""
    read -p "Choose an option (1/2/3): " CHOICE
    case $CHOICE in
        1)
            FEATURE_BRANCH="" # Skip branch deletion logic
            ;;
        2)
            FEATURE_BRANCH="" # Skip branch deletion logic
            SKIP_PULL=true
            ;;
        *)
            echo "Cancelled."
            exit 0
            ;;
    esac
elif [[ "$CURRENT_BRANCH" == "HEAD" ]]; then
    echo -e "${RED}⚠️  You're in a detached HEAD state${NC}"
    echo "Please checkout a branch first."
    exit 1
else
    FEATURE_BRANCH="$CURRENT_BRANCH"
    echo -e "🔍 Checking current branch: ${YELLOW}$FEATURE_BRANCH${NC} ✅"
fi

# Step 2: Merge Verification (only if we have a feature branch)
if [[ -n "$FEATURE_BRANCH" ]]; then
    # Fetch origin to ensure we have latest refs for comparison
    echo "Fetching origin..."
    git fetch origin develop > /dev/null 2>&1

    # Check if merged to remote develop (preferred) or local develop
    if git branch -r --merged origin/develop | grep -q "$FEATURE_BRANCH" || git branch --merged develop | grep -q "$FEATURE_BRANCH"; then
        echo -e "${GREEN}✅ Verified: Branch merged to develop${NC}"
    else
        echo -e "${YELLOW}⚠️  WARNING: Branch '$FEATURE_BRANCH' does not appear in merged branches${NC}"
        echo "This usually means the PR hasn't been merged yet or local develop is outdated."
        echo ""
        echo "What would you like to do?"
        echo "1. Abort cleanup (recommended)"
        echo "2. Switch to develop but KEEP branch"
        echo "3. Force cleanup (stash & delete branch)"
        echo ""
        read -p "Choose an option (1/2/3): " CHOICE
        case $CHOICE in
            2)
                KEEP_BRANCH=true
                ;;
            3)
                FORCE_CLEANUP=true
                ;;
            *)
                echo "Aborted."
                exit 0
                ;;
        esac
    fi
fi

# Step 3: Uncommitted Changes Handling
if [[ -n "$(git status --porcelain)" ]]; then
    echo -e "${YELLOW}⚠️  Found uncommitted changes:${NC}"
    git status --short
    echo ""
    read -p "Stash changes and continue? (y/N) " -n 1 -r
    echo ""
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Aborted."
        exit 0
    fi
    git stash save "Auto-stash before cleanup from ${FEATURE_BRANCH:-$CURRENT_BRANCH}"
    STASH_REF=$(git stash list | head -n1)
    echo -e "${GREEN}💾 Stashed changes: $STASH_REF${NC}"
else
    echo -e "${GREEN}✅ No uncommitted changes${NC}"
fi

# Step 4: Switch to Develop
if [[ "$CURRENT_BRANCH" != "develop" ]]; then
    echo "Switching to develop..."
    git checkout develop
    if [[ $? -ne 0 ]]; then
        echo -e "${RED}❌ Failed to checkout develop${NC}"
        exit 1
    fi
    echo -e "${GREEN}📍 Switched to branch 'develop'${NC}"
fi

# Step 5: Pull Latest Changes
if [[ "$SKIP_PULL" != "true" ]]; then
    BEFORE_PULL=$(git rev-parse HEAD)
    echo "Pulling latest changes..."
    if ! git pull origin develop; then
        echo -e "${RED}❌ Error: Pull from origin/develop failed${NC}"
        echo "Please resolve conflicts manually."
        exit 1
    fi
    AFTER_PULL=$(git rev-parse HEAD)
    COMMITS_PULLED=$(git rev-list --count $BEFORE_PULL..$AFTER_PULL)
    echo -e "${GREEN}🔄 Pulled $COMMITS_PULLED new commits from origin/develop${NC}"

    # Check dependencies
    if git diff --name-only $BEFORE_PULL..$AFTER_PULL | grep -q "server/package-lock.json"; then
        DEPS_CHANGED=true
    else
        DEPS_CHANGED=false
    fi
fi

# Step 6: Update Dependencies
if [[ "$DEPS_CHANGED" == "true" ]]; then
    echo -e "${YELLOW}📦 Dependencies changed in server/package-lock.json${NC}"
    echo "🔧 Running npm install..."
    (cd server && npm install)
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}✅ Dependencies updated successfully${NC}"
    else
        echo -e "${RED}⚠️  npm install failed${NC}"
    fi
else
    echo -e "${GREEN}✅ Dependencies up to date${NC}"
fi

# Step 7: Delete Local Feature Branch
if [[ -n "$FEATURE_BRANCH" && "$KEEP_BRANCH" != "true" ]]; then
    echo "Deleting local branch $FEATURE_BRANCH..."
    if [[ "$FORCE_CLEANUP" == "true" ]]; then
        git branch -D "$FEATURE_BRANCH"
    else
        git branch -d "$FEATURE_BRANCH"
    fi
    
    if [[ $? -eq 0 ]]; then
        echo -e "${GREEN}🗑️  Deleted local branch: $FEATURE_BRANCH${NC}"
    else
        echo -e "${RED}⚠️  Failed to delete branch (it might not be fully merged). Use option 3 (Force) next time if you are sure.${NC}"
    fi
fi

# Step 8: Offer Multi-Branch Cleanup
# Find merged branches excluding main, develop, and current
MERGED_BRANCHES=$(git branch --merged develop | grep -v "^\*" | grep -vE "^\s*(develop|main)$" | sed 's/^[[:space:]]*//')
BRANCH_COUNT=$(echo "$MERGED_BRANCHES" | grep -v "^$" | wc -l | tr -d ' ')

if [[ $BRANCH_COUNT -gt 0 ]]; then
    echo ""
    echo -e "${YELLOW}📋 Found $BRANCH_COUNT other merged branch(es):${NC}"
    echo "$MERGED_BRANCHES" | head -10
    if [[ $BRANCH_COUNT -gt 10 ]]; then
        echo "... and $((BRANCH_COUNT - 10)) more"
    fi
    
    echo ""
    read -p "Delete all these merged branches? (y/N) " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "$MERGED_BRANCHES" | xargs git branch -d
        echo -e "${GREEN}🗑️  Deleted $BRANCH_COUNT merged branches${NC}"
    fi
fi

# Step 9: Summary
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "${GREEN}✅ Post-Merge Cleanup Complete${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo -e "📍 Current branch: ${GREEN}develop${NC}"
if [[ "$SKIP_PULL" != "true" ]]; then
    echo -e "🔄 Pulled ${GREEN}${COMMITS_PULLED:-0}${NC} new commits"
fi
if [[ "$DEPS_CHANGED" == "true" ]]; then
    echo -e "📦 Dependencies: ${GREEN}updated${NC}"
else
    echo -e "📦 Dependencies: ${GREEN}up to date${NC}"
fi

if [[ -n "$FEATURE_BRANCH" && "$KEEP_BRANCH" != "true" ]]; then
    echo -e "🗑️  Deleted local branch: ${RED}$FEATURE_BRANCH${NC}"
    echo -e "ℹ️  Remote branch still exists: origin/$FEATURE_BRANCH"
fi

if [[ -n "$STASH_REF" ]]; then
    echo -e "💾 Stashed changes: ${YELLOW}$STASH_REF${NC}"
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
