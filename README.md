# AI PR Review Assistant

## Summary-Only AI Review

Task 8 adds summary-only LLM integration for pull request review comments.

How to provide the OpenAI API key:

- Set `OPENAI_API_KEY` in the workflow environment, or
- Pass the GitHub Action input `openai_api_key`, which is exposed to the runtime as `INPUT_OPENAI_API_KEY`

Behavior:

- The action sends the structured review context to the LLM provider.
- The returned model text is parsed and validated before any AI findings are published.
- Only validated summary findings are included in the PR summary comment.
- Raw model output is never published in the summary comment.

Degradation behavior:

- Missing API key produces a safe summary skip message. This can happen when fork pull request secrets are unavailable.
- Timeout, rate limit, provider response shape invalid, and malformed JSON all degrade safely to summary-only status messaging.
- Inline comments and snippet matching are not part of this task.

## Reviewer Configuration

Task 5 adds repository-level reviewer configuration through `.ai-pr-review.yml`.

If the file is missing, the action uses safe defaults:

```yml
language: zh-CN
max_files: 20
max_patch_chars_per_file: 6000
include_full_file_context: false
exclude:
  - dist/**
  - build/**
  - coverage/**
  - node_modules/**
  - package-lock.json
  - pnpm-lock.yaml
  - yarn.lock
  - "*.min.js"
  - "*.min.css"
review:
  severity_threshold: medium
  max_inline_comments: 5
  confidence_threshold: 0.75
  focus:
    - bug-risk
    - security
    - test-coverage
    - maintainability
    - react-hooks
    - typescript-types
```

Supported fields:

- `language`
- `max_files`
- `max_patch_chars_per_file`
- `include_full_file_context`
- `exclude`
- `review.severity_threshold`
- `review.max_inline_comments`
- `review.confidence_threshold`
- `review.focus`

Notes:

- Unknown fields fail validation with a clear error.
- Invalid values fail validation with a clear error.
- `exclude` merges user patterns on top of the default exclude list.
- `max_files` limits the included reviewable files after diff filtering.
- `max_patch_chars_per_file` controls patch truncation for included files.
- `include_full_file_context` and `review.max_inline_comments` are parsed and validated only in this task.

## Demo Fixtures

Task 11 adds curated review fixtures under `demo/fixtures/` for four common PR risk patterns:

- auth bug
- React hook stale closure
- missing error handling
- unsafe token handling

Each fixture includes a `.diff` file and a matching `.expected.json` file that is validated against the current structured review parser in `test/unit/fixtures/demoFixtures.test.ts`.
