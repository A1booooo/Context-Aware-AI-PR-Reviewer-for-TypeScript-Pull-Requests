# AGENTS.md

## Project Rules

This repository implements a Context-Aware AI PR Reviewer for TypeScript Pull Requests as a GitHub Action.

The project must be developed step by step. Do not implement future tasks early.

## Hard Rules

1. Implement one task at a time.
2. Only work on the current task described by the user.
3. Do not implement future PRs or unrelated features early.
4. Keep the GitHub Action runnable after every task.
5. Keep modules small, explicit, and testable.
6. Prefer simple readable TypeScript over clever abstractions.
7. Every behavior change must include or update tests.
8. Do not add dependencies unless clearly necessary.
9. Never log secrets, API keys, tokens, or authorization headers.
10. Never publish inline comments unless the finding is validated against added lines in the patch.
11. If inline publishing fails, degrade to the summary comment instead of failing the whole Action.
12. LLM output must be parsed and validated before publishing.
13. If a task is out of scope, do not implement it.
14. Do not reorder, merge, or skip tasks in TASKS.md unless the user explicitly asks.
15. After each task, report:
    - changed files
    - implemented behavior
    - tests added or updated
    - verification commands
    - intentionally not implemented items

## Completion Reports

After each task, provide a completion report with:

- Changed files
- Implemented behavior
- Tests added or updated
- Verification commands and results
- Intentionally not implemented items

## Architecture Boundaries

Use this module layout as the default direction:

```
src/
  main.ts
  github/
    client.ts
    pr.ts
    comments.ts
  config/
    loadConfig.ts
    schema.ts
  diff/
    filterFiles.ts
    truncatePatch.ts
    matchSnippet.ts
  context/
    buildReviewContext.ts
  llm/
    client.ts
    parseReview.ts
    schema.ts
  review/
    formatSummary.ts
    publishSummary.ts
    publishInline.ts
  utils/
    logger.ts
    errors.ts
test/
  fixtures/
  unit/
demo/
  fixtures/
```

Do not create large catch-all files.

## MVP Priority

The first priority is a stable PR summary review loop.

Inline comments are a later enhancement and must not block the core summary comment flow.
