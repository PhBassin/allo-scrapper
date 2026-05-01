# Git Issue Branch PR Flow

## Purpose

Execute a safe, repeatable repository workflow for code that is already implemented or ready to be committed:

1. create a detailed GitHub issue,
2. create a branch whose name includes the issue number,
3. produce an atomic commit,
4. push the branch,
5. create a detailed PR.

This skill exists to avoid the common failure modes seen in ad hoc shell usage:
- broken `gh issue create` / `gh pr create` bodies caused by backticks or shell interpolation,
- branch names that do not include the issue number,
- oversized or mixed-purpose commits,
- PRs missing rationale, validation, or linkage to the issue.

## When To Use

Use this skill when the user asks for a workflow like:
- "create issue, branch, commit, push, and PR"
- "open a detailed PR for this change"
- "make an atomic commit and create the GitHub artifacts"

Do not use it if:
- the user did not ask for a commit or PR,
- there are no relevant code changes,
- the working tree includes unrelated changes that make a safe atomic commit impossible without clarification.

## Required Outcome

At completion, provide the user with:
- issue number and URL,
- branch name,
- commit hash and message,
- PR number and URL,
- test commands actually run.

## Workflow

### Step 1: Inspect Git State First

Before changing anything, inspect repository state with parallel git commands:
- `git status --short`
- `git diff --stat`
- `git diff --name-only`
- `git log --oneline -10`
- `git branch --show-current`
- `git rev-parse --abbrev-ref --symbolic-full-name @{u}` when possible

Goals:
- identify only the files intended for this workflow,
- understand commit message style,
- determine whether the current branch already tracks a remote branch,
- detect whether this should be a stacked PR or a new branch from `develop`.

### Step 2: Determine Base Branch Strategy

Default rules:
- if the user already has an active feature branch with an open PR and the new change clearly depends on it, create a stacked follow-up branch from the current branch,
- otherwise create the new branch from `develop`,
- if the situation is ambiguous, ask one short question before branching.

Record:
- `BASE_BRANCH` for PR targeting,
- `START_BRANCH` for the branch creation point.

### Step 3: Draft The Issue Before Branching

Create the issue first so the branch and commit can reference the issue number.

Issue quality standard:
- concise but specific title,
- clear summary,
- problem statement,
- expected outcome,
- scope boundaries,
- validation steps,
- related context if relevant.

Critical rule:
- always pass issue bodies via HEREDOC to avoid shell quoting bugs.

Use this safe pattern:

```bash
gh issue create --title "<title>" --body "$(cat <<'EOF'
## Summary
...

## Problem
...

## Expected Outcome
...

## Validation
- `...`
EOF
)"
```

Never inline markdown containing backticks directly inside a quoted shell string.

After creation:
- capture the issue number from the URL,
- if the create call partially succeeds but the body is malformed, immediately repair it with `gh issue edit <number> --body "$(cat <<'EOF' ... EOF)"`.

### Step 4: Create The Branch With The Issue Number

Branch naming rule:
- branch name must include the issue number,
- branch prefix should match the type of work.

Preferred patterns:
- `fix/<issue-number>-<slug>`
- `feat/<issue-number>-<slug>`
- `test/<issue-number>-<slug>`
- `docs/<issue-number>-<slug>`
- `chore/<issue-number>-<slug>`
- `refactor/<issue-number>-<slug>`

Examples:
- `test/950-populated-idempotency-coverage`
- `fix/812-handle-null-webhook-payloads`

Branching rules:
- if creating from `develop`, ensure local `develop` is the intended base first,
- if creating a stacked PR, branch from the current feature branch,
- do not rename an existing branch just to force this pattern unless the user explicitly asks.

### Step 5: Preserve Atomic Commit Scope

Create one atomic commit for one logical change.

Rules:
- stage only files relevant to the issue,
- do not sweep unrelated edits into the commit,
- if the worktree contains unrelated changes, leave them untouched,
- if the intended change itself is not atomic, split into multiple commits only if the user asked for that or the separation is clearly safer.

Commit message rules:
- use the repository's observed convention style,
- keep it concise,
- include the issue number,
- describe the purpose, not a file list.

Good examples:
- `test(migrations): cover populated database rerun scenarios (#950)`
- `fix(auth): reject malformed refresh tokens (#812)`

### Step 6: Verify Before Push

Run the smallest relevant verification commands that honestly validate the change.

Rules:
- prefer targeted tests for the changed area,
- include broader suite coverage only when justified or requested,
- never claim tests were run if they were not.

Capture the exact commands and outcomes for the PR body.

### Step 7: Push Safely

Push with upstream tracking:

```bash
git push -u origin <branch-name>
```

Do not force push.

### Step 8: Create A Detailed PR

PR body quality standard:
- short summary bullets,
- why the change is needed,
- exactly what changed,
- scope statement,
- validation commands,
- issue linkage,
- stacked-PR note if relevant.

Always use HEREDOC for the body:

```bash
gh pr create \
  --base "<base-branch>" \
  --head "<head-branch>" \
  --title "<pr-title>" \
  --body "$(cat <<'EOF'
## Summary
- ...

## Why
...

## What Changed
- ...

## Validation
- `...`

## Related
- Closes #123
EOF
)"
```

PR title rules:
- usually match the commit intent,
- keep it concise,
- avoid overly generic titles like `fix stuff`.

For stacked PRs:
- target the parent feature branch, not `develop`,
- explicitly say the PR is stacked,
- reference the parent PR number if known.

For non-stacked PRs:
- target `develop` unless repo workflow says otherwise.

### Step 9: Final Report To User

Return a clean summary with:
- issue: `#123` + URL,
- branch: `type/123-short-slug`,
- commit: short hash + message,
- PR: `#456` + URL,
- base/head branch info,
- verification commands run.

## Decision Rules

### If An Issue Already Exists

Reuse the existing issue instead of creating a duplicate if the user explicitly points to one or the mapping is obvious.

### If There Is Already An Open PR On The Current Branch

Ask whether to:
- update the existing PR,
- create a stacked follow-up PR,
- or isolate a standalone branch from `develop`.

If the dependency on the current branch is obvious, recommend a stacked follow-up PR.

### If The Issue Body Or PR Body Needs Markdown With Backticks

Never inline it directly in the shell command string. Always use HEREDOC.

### If The Worktree Contains Unrelated Changes

Do not revert them.
Only stage the files relevant to the requested workflow.
If commit boundaries are unclear, ask one short question.

## Safety Rules

- never commit without explicit user intent,
- never push without explicit user intent,
- never use `--force`, `--amend`, or destructive git commands unless explicitly requested,
- never fabricate test results,
- never open a PR with a vague body when the user asked for a detailed one,
- never lose markdown formatting due to shell interpolation mistakes.

## Output Checklist

Before finishing, verify all of the following are true:
- issue exists and body is correctly formatted,
- branch exists and contains the issue number,
- commit is atomic,
- remote branch is pushed,
- PR exists with a detailed body,
- returned URLs are correct,
- validation commands in the PR are the ones actually run.
