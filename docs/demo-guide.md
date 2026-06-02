# Demo Guide

This guide is for demonstrating the current implemented behavior of the repository. It does not assume a recorded demo video already exists.

## Demo Goal

A good Task 12 demo should help a new reviewer understand:

- what the Action is trying to do
- where the summary comment is the stable core path
- how configuration changes review scope
- how inline findings are validated and downgraded
- how reruns update the same summary comment
- what limitations still exist in the checked-in runtime

## What To Demo

Cover these implemented behaviors:

- summary upsert by marker
- config defaults and `.ai-pr-review.yml`
- file filtering and patch truncation
- structured AI output validation
- inline validation against added lines
- inline-to-summary degradation when validation or publishing fails
- multiple small PR fixtures with different risk shapes

Do not claim in the demo:

- that live GitHub Actions startup wiring is complete
- that the Action already supports non-GitHub platforms
- that a recorded video is included in the repository

## Demo Assets

Available fixture pairs in [`demo/fixtures`](/E:/牛牛/demo/fixtures):

- [`pr-1-auth-bug.diff`](/E:/牛牛/demo/fixtures/pr-1-auth-bug.diff)
- [`pr-1-auth-bug.expected.json`](/E:/牛牛/demo/fixtures/pr-1-auth-bug.expected.json)
- [`pr-2-react-effect-bug.diff`](/E:/牛牛/demo/fixtures/pr-2-react-effect-bug.diff)
- [`pr-2-react-effect-bug.expected.json`](/E:/牛牛/demo/fixtures/pr-2-react-effect-bug.expected.json)
- [`pr-3-error-handling.diff`](/E:/牛牛/demo/fixtures/pr-3-error-handling.diff)
- [`pr-3-error-handling.expected.json`](/E:/牛牛/demo/fixtures/pr-3-error-handling.expected.json)
- [`pr-4-token-storage.diff`](/E:/牛牛/demo/fixtures/pr-4-token-storage.diff)
- [`pr-4-token-storage.expected.json`](/E:/牛牛/demo/fixtures/pr-4-token-storage.expected.json)

Fixture validation test:

- [`test/unit/fixtures/demoFixtures.test.ts`](/E:/牛牛/test/unit/fixtures/demoFixtures.test.ts)

## Recommended Demo Narrative

### Part 1: Position The Project

Explain the narrow claim:

- this project is an AI review summary layer for PRs
- it complements `ESLint`, `TypeScript`, `CodeQL`, and `reviewdog`
- it is strongest when used as a context-aware reviewer over changed code
- the stable core path today is summary publishing, not full marketplace-ready runtime wiring

### Part 2: Show The Architecture

Point to:

- [`src/main.ts`](/E:/牛牛/src/main.ts)
- [`src/diff/filterFiles.ts`](/E:/牛牛/src/diff/filterFiles.ts)
- [`src/context/buildReviewContext.ts`](/E:/牛牛/src/context/buildReviewContext.ts)
- [`src/llm/client.ts`](/E:/牛牛/src/llm/client.ts)
- [`src/llm/parseReview.ts`](/E:/牛牛/src/llm/parseReview.ts)
- [`src/review/publishSummary.ts`](/E:/牛牛/src/review/publishSummary.ts)
- [`src/review/publishInline.ts`](/E:/牛牛/src/review/publishInline.ts)

Key talking point:

- summary publication is deterministic and marker-based
- inline publication is conditional and best-effort

### Part 3: Show Configuration

Point to the README config example and explain:

- defaults are safe and conservative
- user excludes merge with default excludes
- `include_full_file_context` is off by default
- `max_patch_chars_per_file` controls truncation per included file
- `review.confidence_threshold` and `review.max_inline_comments` directly affect inline eligibility

Recommended config examples to talk through:

- default config for conservative review
- smaller `max_files` to keep review scope tight
- higher `confidence_threshold` to show more inline downgrades

### Part 4: Walk Through Multiple Small PRs

Use the four fixture families as short scenarios rather than one big run:

- auth bug
  - show a security-oriented issue shape
- React effect bug
  - show hook or stale-closure-oriented review focus
- error handling
  - show robustness and failure-path review focus
- token storage
  - show unsafe secret or storage risk discussion

Expected demo message:

- fixtures represent common TypeScript or React PR risks
- they do not guarantee that any real provider will always produce identical natural-language findings
- the repository only guarantees schema validation and safe handling around those findings

## Summary Upsert Demo

What to explain:

- summary comments use marker `<!-- ai-pr-review-assistant -->`
- reruns update the bot-authored marker comment instead of creating duplicates

Where to show it:

- [`src/review/formatSummary.ts`](/E:/牛牛/src/review/formatSummary.ts)
- [`src/github/comments.ts`](/E:/牛牛/src/github/comments.ts)
- [`test/unit/review/publishSummary.test.ts`](/E:/牛牛/test/unit/review/publishSummary.test.ts)

Demo framing:

- first run creates the summary
- second run updates the same marker comment
- this is the repository's stable PR-summary loop

## Configuration Demo

Good config behaviors to demonstrate verbally or through tests:

- no config file means defaults
- invalid config fails clearly
- `exclude` patterns remove matching files from reviewable input
- `max_files` caps included files after filtering
- `max_patch_chars_per_file` keeps oversized patches bounded

Where to show it:

- [`src/config/loadConfig.ts`](/E:/牛牛/src/config/loadConfig.ts)
- [`test/unit/config/loadConfig.test.ts`](/E:/牛牛/test/unit/config/loadConfig.test.ts)
- [`test/unit/diff/filterFiles.test.ts`](/E:/牛牛/test/unit/diff/filterFiles.test.ts)

## Inline And File-Level Degradation Demo

This is one of the most important parts to explain accurately.

### Inline Validation Degradation

Show that inline comments are not published blindly.

A candidate inline finding is downgraded when:

- confidence is below threshold
- the referenced file is not in included patches
- the snippet does not match an added line
- the snippet only matches non-added lines
- the run already reached `max_inline_comments`

Where to show it:

- [`src/diff/matchSnippet.ts`](/E:/牛牛/src/diff/matchSnippet.ts)
- [`test/unit/diff/matchSnippet.test.ts`](/E:/牛牛/test/unit/diff/matchSnippet.test.ts)

### Publish-Failure Degradation

Show that even valid inline findings are still best-effort.

If GitHub review-comment publishing fails:

- the failing inline finding is downgraded with reason `publish_failed`
- the whole Action does not fail just because one inline comment failed
- the summary still includes the downgraded finding

Where to show it:

- [`src/review/publishInline.ts`](/E:/牛牛/src/review/publishInline.ts)
- [`test/unit/review/publishInline.test.ts`](/E:/牛牛/test/unit/review/publishInline.test.ts)
- [`test/unit/main.test.ts`](/E:/牛牛/test/unit/main.test.ts)

### File-Level Degradation

Also explain non-inline degradation paths:

- missing OpenAI API key
- timeout
- rate limit
- provider response invalid
- request failed
- malformed structured JSON

Result:

- summary status becomes `skipped` or `degraded`
- raw model output is not published

Where to show it:

- [`src/llm/client.ts`](/E:/牛牛/src/llm/client.ts)
- [`src/llm/parseReview.ts`](/E:/牛牛/src/llm/parseReview.ts)
- [`test/unit/llm/client.test.ts`](/E:/牛牛/test/unit/llm/client.test.ts)
- [`test/unit/llm/parseReview.test.ts`](/E:/牛牛/test/unit/llm/parseReview.test.ts)

## Multiple Small PR Demo Structure

Recommended order:

1. start with `pr-1-auth-bug` to establish the summary format
2. use `pr-2-react-effect-bug` to explain review focus and inline validation
3. use `pr-3-error-handling` to discuss degraded or summary-only handling
4. use `pr-4-token-storage` to reinforce security-oriented findings and safe publishing boundaries

Why this works:

- each PR is small
- each fixture highlights a different risk family
- the audience can follow the review pipeline without losing the thread in one oversized diff

## Demo Risks To Call Out

Be explicit about these risks during the demo:

- the current checked-in action entrypoint is not yet fully wired for live PR collection
- provider output can vary, so fixture expectations are schema-level and scenario-level, not wording guarantees
- inline comments depend on exact added-line snippet matching
- exclude matching is intentionally simpler than a full glob engine
- full file context is optional and constrained by safety limits

## Suggested Demo Checklist

Use this checklist before recording or presenting:

- verify `npm.cmd test` passes
- verify `npm.cmd run build` passes
- confirm README examples match current `package.json` and `action.yml`
- confirm `.ai-pr-review.yml` example only uses implemented fields
- confirm you can explain the difference between summary publishing and inline publishing
- confirm you can explain marker-based upsert
- confirm you can explain at least one inline downgrade path
- confirm you can explain at least one provider-side degradation path
- confirm you can point to all four fixture pairs
- confirm you state the runtime wiring limitation clearly

## Suggested Demo Video Outline

If a demo video is recorded later, this is a safe outline:

1. repository purpose and boundaries
2. architecture overview
3. config file walkthrough
4. summary upsert explanation
5. inline validation and degradation explanation
6. walkthrough of multiple small fixture PRs
7. limitations and future improvements

This outline is only a guide. No video artifact is included in the repository today.
