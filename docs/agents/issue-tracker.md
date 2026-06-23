# Issue tracker

This repo's issues are tracked on **GitHub Issues** (repository: `PhBassin/allo-scrapper`).

## Tooling

The `gh` CLI is used to read and write issues. The `triage`, `to-issues`, `to-prd`, and `qa` skills shell out to `gh issue {list,view,create,edit,comment,label}` and `gh pr` as needed.

If `gh` is not authenticated, prompt the user to run `gh auth login` before continuing.

## PRs as a request surface

**Disabled.** External pull requests are NOT pulled into the triage queue. Only GitHub Issues go through the `triage` state machine.