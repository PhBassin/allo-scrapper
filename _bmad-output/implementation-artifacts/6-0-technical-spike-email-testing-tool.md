# Story 6.0: Technical Spike - Email Testing Tool

Status: ready-for-dev

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a QA engineer,
I want to evaluate Litmus vs Email on Acid and produce a PoC for automated email testing,
so that the rest of Epic 6 is unblocked.

## Acceptance Criteria

1. **Given** the need for cross-client email validation
   **When** evaluating Litmus vs Email on Acid
   **Then** a clear comparison is produced highlighting API integration capabilities, CI/CD friendliness, pricing, and speed.

2. **Given** a selected email testing tool
   **When** setting up a Proof of Concept (PoC)
   **Then** an integration script is created to trigger a test on at least one email client (e.g., Gmail or Outlook)
   **And** the test result can be parsed programmatically (e.g., passing/failing or returning screenshots).

3. **Given** the completion of the spike
   **When** preparing for Story 6.1
   **Then** a final architectural decision is documented
   **And** any required API keys or secrets are identified for the CI pipeline setup.

## Tasks / Subtasks

- [ ] Task 1 — Research and comparison (AC: 1)
  - [ ] Review Litmus API documentation for automated testing.
  - [ ] Review Email on Acid API documentation for automated testing.
  - [ ] Document the pros/cons of each tool specifically for automated CI/CD integration.
- [ ] Task 2 — Develop Proof of Concept (AC: 2)
  - [ ] Select the most appropriate tool based on Task 1.
  - [ ] Create a small PoC script (e.g., in `server/scripts/` or `tests/`) that sends a dummy HTML payload to the tool's API.
  - [ ] Retrieve and parse the response to demonstrate end-to-end viability.
- [ ] Task 3 — Document decision (AC: 3)
  - [ ] Write a brief Technical Decision document or update the Epic Notes summarizing the choice.
  - [ ] Provide instructions for injecting the necessary API keys into the `.env` / GitHub Actions secrets.

## Dev Notes

- **Architecture:** This is a spike. The code produced does not need to be production-ready but must prove the capability to integrate with our Node.js testing stack (Vitest / Playwright).
- **Libraries:** You may use standard fetch/axios or the tool's official SDK if one exists.
- **Constraints:** Do not sign up for paid accounts. If no free tier API is available, rely purely on documentation analysis for the tool selection, and use mock implementations for the PoC to demonstrate how our test suite would interact with the API.
- **Dependencies:** This unblocks Story 6.1. Keep the output focused on CI/CD integration.

### Project Structure Notes

- PoC scripts can be placed in `server/scripts/email-spike/` or a similar isolated directory so they don't pollute the main application until formal integration in Story 6.1.

### References

- Epic 6 Definition: `_bmad-output/planning-artifacts/epics.md`
- Issue: [#982](https://github.com/PhBassin/allo-scrapper/issues/982)

## Dev Agent Record

### Agent Model Used

gemini-3.1-pro-preview

### Debug Log References

### Completion Notes List

### File List
