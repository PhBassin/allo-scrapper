#!/usr/bin/env node

/**
 * Docker Image Age Diagnostic Script
 * 
 * Analyzes GHCR package versions to compare created_at vs updated_at timestamps
 * Helps determine which timestamp should be used for cleanup decisions
 * 
 * Usage:
 *   node scripts/diagnose-docker-image-ages.js
 * 
 * Requirements:
 *   - GitHub CLI (gh) must be installed and authenticated
 *   - Read access to package registry
 */

import { execSync } from 'child_process';

const PACKAGE_NAME = 'allo-scrapper';
const RETENTION_DAYS = 7;
const KEEP_RECENT_PRS = 5;

// Color codes for output
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

const log = {
  info: (msg) => console.log(`${colors.blue}ℹ${colors.reset} ${msg}`),
  success: (msg) => console.log(`${colors.green}✓${colors.reset} ${msg}`),
  warning: (msg) => console.log(`${colors.yellow}⚠${colors.reset} ${msg}`),
  error: (msg) => console.log(`${colors.red}✗${colors.reset} ${msg}`),
  header: (msg) => console.log(`\n${colors.bright}${colors.cyan}${'='.repeat(80)}${colors.reset}`),
  title: (msg) => console.log(`${colors.bright}${msg}${colors.reset}`),
};

// Tag classification functions
const isProtectedTag = (tags) => {
  const protectedPatterns = [
    /^v?\d+\.\d+/,                    // Semver: v3.0.0, 3.0, 3.0.0-beta.4
    /^(latest|stable|develop|main)$/  // Special tags
  ];
  return tags.some(tag => protectedPatterns.some(pattern => pattern.test(tag)));
};

const isPRTag = (tags) => {
  return tags.some(tag => /^pr-\d+$/.test(tag));
};

const isSHATag = (tags) => {
  return tags.some(tag => /^sha-[a-f0-9]+$/.test(tag));
};

const extractPRNumber = (tags) => {
  const prTag = tags.find(tag => /^pr-\d+$/.test(tag));
  return prTag ? parseInt(prTag.split('-')[1]) : null;
};

const formatDate = (dateStr) => {
  const date = new Date(dateStr);
  return date.toISOString().split('T')[0];
};

const daysAgo = (dateStr) => {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now - date) / (24 * 60 * 60 * 1000));
};

async function fetchPackageVersions() {
  log.info('Fetching package versions from GHCR...');
  
  try {
    // Get repository owner
    const owner = execSync('git config --get remote.origin.url', { encoding: 'utf-8' })
      .trim()
      .match(/github\.com[:/]([^/]+)\//)?.[1] || 'PhBassin';
    
    log.info(`Repository owner: ${owner}`);
    
    // Fetch package versions using GitHub CLI
    // Use /users/{owner}/packages/container/{package}/versions endpoint
    const cmd = `gh api "users/${owner}/packages/container/${PACKAGE_NAME}/versions?per_page=100" --paginate`;
    const output = execSync(cmd, { encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024 });
    
    const versions = JSON.parse(output);
    log.success(`Fetched ${versions.length} package versions`);
    
    return versions;
  } catch (error) {
    log.error(`Failed to fetch package versions: ${error.message}`);
    if (error.message.includes('403')) {
      log.warning('You may need to authenticate with: gh auth refresh -h github.com -s read:packages');
    }
    process.exit(1);
  }
}

function analyzeVersions(versions) {
  const cutoffDate = new Date(Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000);
  
  const stats = {
    total: versions.length,
    
    // By tag type
    semver: 0,
    special: 0,
    pr: 0,
    sha: 0,
    untagged: 0,
    
    // By age (created_at)
    createdRecent: 0,
    createdOld: 0,
    
    // By age (updated_at)
    updatedRecent: 0,
    updatedOld: 0,
    
    // Discrepancy analysis
    createdOldButUpdatedRecent: 0, // Old images that appear recent due to updates
    
    // Deletion scenarios
    wouldDeleteByCreated: 0,
    wouldDeleteByUpdated: 0,
  };
  
  const examples = {
    semver: [],
    special: [],
    recentPRs: [],
    oldPRs: [],
    oldSHA: [],
    discrepancy: [], // Old by created_at, recent by updated_at
    wouldDeleteByCreatedOnly: [], // Would delete by created_at but not updated_at
  };
  
  // Extract and sort PR versions to find recent ones
  const prVersions = versions
    .filter(v => {
      const tags = v.metadata?.container?.tags ?? [];
      return isPRTag(tags);
    })
    .map(v => {
      const tags = v.metadata?.container?.tags ?? [];
      return {
        ...v,
        prNumber: extractPRNumber(tags),
        tags,
      };
    })
    .filter(v => v.prNumber !== null)
    .sort((a, b) => b.prNumber - a.prNumber);
  
  const recentPRNumbers = prVersions.slice(0, KEEP_RECENT_PRS).map(v => v.prNumber);
  
  log.info(`Protected recent PRs: ${recentPRNumbers.join(', ')}`);
  
  // Analyze each version
  for (const version of versions) {
    const tags = version.metadata?.container?.tags ?? [];
    const createdAt = new Date(version.created_at);
    const updatedAt = new Date(version.updated_at);
    const createdDays = daysAgo(version.created_at);
    const updatedDays = daysAgo(version.updated_at);
    const prNumber = extractPRNumber(tags);
    
    const isCreatedOld = createdAt < cutoffDate;
    const isUpdatedOld = updatedAt < cutoffDate;
    
    // Track by age
    if (isCreatedOld) stats.createdOld++;
    else stats.createdRecent++;
    
    if (isUpdatedOld) stats.updatedOld++;
    else stats.updatedRecent++;
    
    // Track discrepancies
    if (isCreatedOld && !isUpdatedOld) {
      stats.createdOldButUpdatedRecent++;
      if (examples.discrepancy.length < 10) {
        examples.discrepancy.push({
          tags: tags.join(', ') || '(untagged)',
          created: formatDate(version.created_at),
          createdDays,
          updated: formatDate(version.updated_at),
          updatedDays,
        });
      }
    }
    
    // Classify by tag type
    if (isProtectedTag(tags)) {
      if (tags.some(t => /^v?\d+\.\d+/.test(t))) {
        stats.semver++;
        if (examples.semver.length < 5) {
          examples.semver.push(tags.join(', '));
        }
      } else {
        stats.special++;
        if (examples.special.length < 5) {
          examples.special.push(tags.join(', '));
        }
      }
    } else if (isPRTag(tags) && prNumber && recentPRNumbers.includes(prNumber)) {
      stats.pr++;
      if (examples.recentPRs.length < 5) {
        examples.recentPRs.push(`pr-${prNumber} (created ${createdDays}d ago)`);
      }
    } else if (isPRTag(tags)) {
      stats.pr++;
      if (isCreatedOld && examples.oldPRs.length < 5) {
        examples.oldPRs.push(`pr-${prNumber} (created ${createdDays}d ago, updated ${updatedDays}d ago)`);
      }
    } else if (isSHATag(tags)) {
      stats.sha++;
      if (isCreatedOld && examples.oldSHA.length < 5) {
        examples.oldSHA.push(`${tags.join(', ')} (created ${createdDays}d ago, updated ${updatedDays}d ago)`);
      }
    } else if (tags.length === 0) {
      stats.untagged++;
    }
    
    // Determine if would be deleted under each strategy
    const isProtected = isProtectedTag(tags) || (isPRTag(tags) && prNumber && recentPRNumbers.includes(prNumber));
    
    if (!isProtected) {
      if (isCreatedOld) {
        stats.wouldDeleteByCreated++;
        
        // Would delete by created_at but NOT by updated_at?
        if (!isUpdatedOld && examples.wouldDeleteByCreatedOnly.length < 10) {
          examples.wouldDeleteByCreatedOnly.push({
            tags: tags.join(', ') || '(untagged)',
            created: formatDate(version.created_at),
            createdDays,
            updated: formatDate(version.updated_at),
            updatedDays,
          });
        }
      }
      
      if (isUpdatedOld) {
        stats.wouldDeleteByUpdated++;
      }
    }
  }
  
  return { stats, examples };
}

function printReport(stats, examples) {
  log.header();
  log.title('📊 Docker Image Age Diagnostic Report');
  log.header();
  
  console.log(`\n${colors.bright}Total Images:${colors.reset} ${stats.total}\n`);
  
  // Tag type breakdown
  console.log(`${colors.bright}By Tag Type:${colors.reset}`);
  console.log(`  Semver tags:     ${stats.semver}`);
  console.log(`  Special tags:    ${stats.special}`);
  console.log(`  PR tags:         ${stats.pr}`);
  console.log(`  SHA tags:        ${stats.sha}`);
  console.log(`  Untagged:        ${stats.untagged}`);
  
  // Age comparison
  log.header();
  log.title(`⏰ Age Analysis (${RETENTION_DAYS}-day cutoff)`);
  log.header();
  
  console.log(`\n${colors.bright}Using created_at:${colors.reset}`);
  console.log(`  Recent (< ${RETENTION_DAYS} days): ${stats.createdRecent} ${colors.green}(would keep)${colors.reset}`);
  console.log(`  Old (> ${RETENTION_DAYS} days):    ${stats.createdOld} ${colors.yellow}(eligible for deletion)${colors.reset}`);
  
  console.log(`\n${colors.bright}Using updated_at:${colors.reset}`);
  console.log(`  Recent (< ${RETENTION_DAYS} days): ${stats.updatedRecent} ${colors.green}(would keep)${colors.reset}`);
  console.log(`  Old (> ${RETENTION_DAYS} days):    ${stats.updatedOld} ${colors.yellow}(eligible for deletion)${colors.reset}`);
  
  // Discrepancy analysis
  log.header();
  log.title('🔍 Discrepancy Analysis');
  log.header();
  
  console.log(`\n${colors.bright}Images created > ${RETENTION_DAYS} days ago, but updated recently:${colors.reset} ${stats.createdOldButUpdatedRecent}`);
  
  if (examples.discrepancy.length > 0) {
    console.log(`\n${colors.cyan}Examples:${colors.reset}`);
    examples.discrepancy.forEach(ex => {
      console.log(`  ${colors.yellow}${ex.tags}${colors.reset}`);
      console.log(`    Created: ${ex.created} (${ex.createdDays} days ago) ${colors.red}← OLD${colors.reset}`);
      console.log(`    Updated: ${ex.updated} (${ex.updatedDays} days ago) ${colors.green}← RECENT${colors.reset}`);
    });
    
    if (stats.createdOldButUpdatedRecent > examples.discrepancy.length) {
      console.log(`  ... and ${stats.createdOldButUpdatedRecent - examples.discrepancy.length} more`);
    }
  }
  
  // Deletion comparison
  log.header();
  log.title('🗑️  Deletion Impact Comparison');
  log.header();
  
  console.log(`\n${colors.bright}Would DELETE by created_at:${colors.reset} ${stats.wouldDeleteByCreated}`);
  console.log(`${colors.bright}Would DELETE by updated_at:${colors.reset} ${stats.wouldDeleteByUpdated}`);
  console.log(`${colors.bright}Difference:${colors.reset} ${Math.abs(stats.wouldDeleteByCreated - stats.wouldDeleteByUpdated)} more deletions with created_at`);
  
  if (examples.wouldDeleteByCreatedOnly.length > 0) {
    console.log(`\n${colors.cyan}Images that would ONLY be deleted by created_at strategy:${colors.reset}`);
    examples.wouldDeleteByCreatedOnly.forEach(ex => {
      console.log(`  ${colors.yellow}${ex.tags}${colors.reset}`);
      console.log(`    Created: ${ex.created} (${ex.createdDays}d ago) ${colors.red}→ DELETE${colors.reset}`);
      console.log(`    Updated: ${ex.updated} (${ex.updatedDays}d ago) ${colors.green}→ KEEP${colors.reset}`);
    });
    
    if (stats.wouldDeleteByCreated - stats.wouldDeleteByUpdated > examples.wouldDeleteByCreatedOnly.length) {
      console.log(`  ... and ${stats.wouldDeleteByCreated - stats.wouldDeleteByUpdated - examples.wouldDeleteByCreatedOnly.length} more`);
    }
  }
  
  // Protected examples
  log.header();
  log.title('✅ Protected Images (Never Deleted)');
  log.header();
  
  if (examples.semver.length > 0) {
    console.log(`\n${colors.bright}Semver tags (${stats.semver}):${colors.reset}`);
    examples.semver.forEach(tag => console.log(`  ${colors.green}${tag}${colors.reset}`));
  }
  
  if (examples.special.length > 0) {
    console.log(`\n${colors.bright}Special tags (${stats.special}):${colors.reset}`);
    examples.special.forEach(tag => console.log(`  ${colors.green}${tag}${colors.reset}`));
  }
  
  if (examples.recentPRs.length > 0) {
    console.log(`\n${colors.bright}Recent PRs (last ${KEEP_RECENT_PRS}):${colors.reset}`);
    examples.recentPRs.forEach(tag => console.log(`  ${colors.green}${tag}${colors.reset}`));
  }
  
  // Recommendation
  log.header();
  log.title('💡 Recommendation');
  log.header();
  
  const percentDifference = ((stats.wouldDeleteByCreated - stats.wouldDeleteByUpdated) / stats.total * 100).toFixed(1);
  
  console.log();
  if (stats.createdOldButUpdatedRecent > 0) {
    log.warning(`Found ${stats.createdOldButUpdatedRecent} images that are old but recently updated.`);
    console.log(`\n${colors.bright}Using created_at is RECOMMENDED because:${colors.reset}`);
    console.log(`  1. More accurate - deletes based on when image was actually built`);
    console.log(`  2. Prevents old images from being kept indefinitely due to metadata updates`);
    console.log(`  3. More predictable behavior for CI/CD cleanup`);
    console.log(`  4. Would delete ${stats.wouldDeleteByCreated - stats.wouldDeleteByUpdated} additional old images (~${percentDifference}% of total)`);
  } else {
    log.success('No discrepancy found between created_at and updated_at!');
    console.log(`\n${colors.bright}Either timestamp works:${colors.reset}`);
    console.log(`  - All images have consistent created/updated dates`);
    console.log(`  - Both strategies would delete the same ${stats.wouldDeleteByCreated} images`);
  }
  
  log.header();
  console.log();
}

async function main() {
  console.log(`${colors.bright}${colors.blue}Docker Image Age Diagnostic${colors.reset}\n`);
  console.log(`Package: ${PACKAGE_NAME}`);
  console.log(`Retention: ${RETENTION_DAYS} days`);
  console.log(`Keep recent PRs: ${KEEP_RECENT_PRS}\n`);
  
  const versions = await fetchPackageVersions();
  const { stats, examples } = analyzeVersions(versions);
  printReport(stats, examples);
  
  log.success('Diagnostic complete!');
}

main().catch(error => {
  log.error(`Fatal error: ${error.message}`);
  console.error(error);
  process.exit(1);
});
