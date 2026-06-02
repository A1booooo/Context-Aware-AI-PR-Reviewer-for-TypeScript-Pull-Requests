# Architecture Notes

This document describes the current implemented architecture only, including the default GitHub Actions runtime startup path for GitHub `pull_request` events.

## Current Top-Level Shape

The repository is organized into small modules with explicit boundaries:

```text
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
```

## Module Responsibilities

### `src/main.ts`

Coordinates the implemented workflow.

Current responsibilities:

- create logger
- load reviewer config
- use the default runtime startup path for GitHub `pull_request` events unless a test startup hook is injected
- create GitHub comments client from `GITHUB_TOKEN`
- create OpenAI review client from environment
- run the deterministic summary workflow
- redact secrets in error logging and rethrow failures

Important current boundary:

- `main.ts` orchestrates the review flow
- GitHub event parsing and PR files API access stay in `src/github/*` so `main.ts` remains thin

### `src/config/*`

Configuration loading and validation.

- `schema.ts`
  - defines default config values and TypeScript types
- `loadConfig.ts`
  - reads `.ai-pr-review.yml`
  - parses YAML
  - validates supported fields and value types
  - merges user config with defaults

Boundary:

- config is repository-level input only
- config does not fetch remote data or mutate runtime behavior beyond the documented options

### `src/github/pr.ts`

Pull request metadata and changed-file collection primitives.

- reads GitHub Actions runtime event context for `pull_request` events
- extracts typed PR metadata from a GitHub Action-like context
- paginates pull request files
- classifies files as:
  - `text_patch`
  - `missing_patch`
  - `deleted`

Boundary:

- this module defines the PR data model and collector helpers
- it owns runtime PR context construction and changed-file collection boundaries

### `src/github/comments.ts`

GitHub comment transport and summary upsert behavior.

Implemented responsibilities:

- build comments client from `GITHUB_TOKEN`
- list PR issue comments
- create issue comments
- update issue comments
- create PR review comments
- upsert a summary comment by marker

Boundary:

- this module only handles GitHub comment transport
- it does not decide which findings are valid

### `src/diff/filterFiles.ts`

Diff eligibility and patch truncation entrypoint.

Implemented rules:

- exclude deleted files
- exclude files with missing patches
- exclude generated outputs
- exclude lock files
- exclude minified assets
- exclude docs-only files
- exclude user-configured patterns
- truncate oversized patches
- cap included file count

Boundary:

- this layer decides reviewable vs non-reviewable diff inputs
- it does not perform AI review or publishing

### `src/diff/truncatePatch.ts`

Patch truncation primitive.

Boundary:

- pure truncation logic only
- no file classification

### `src/diff/matchSnippet.ts`

Inline-finding validation against added lines in patches.

Implemented outputs:

- `validatedInlineFindings`
- `downgradedFindings`

Downgrade reasons include:

- `wrong_file`
- `low_confidence`
- `no_match`
- `non_added_line_match`
- `max_inline_comments`
- `publish_failed`

Boundary:

- this layer validates inline eligibility
- it does not call GitHub by itself

### `src/context/buildReviewContext.ts`

Builds deterministic LLM input sections and metadata.

Sections produced today:

- PR metadata
- patch diff
- optional full file context or patch-only fallback
- review focus
- output schema instructions
- metadata notes

Boundary:

- this module prepares context only
- it does not call the LLM or publish anything

### `src/llm/client.ts`

OpenAI transport and request/result degradation handling.

Implemented behavior:

- read API key from `OPENAI_API_KEY` or `INPUT_OPENAI_API_KEY`
- call Chat Completions API
- request JSON object output
- return typed statuses:
  - `success`
  - `skipped`
  - `failed`

Boundary:

- this module talks to the provider
- it does not trust the provider response as publishable review output

### `src/llm/parseReview.ts` and `src/llm/schema.ts`

Structured response validation.

Implemented responsibilities:

- parse JSON or code-fenced JSON
- validate expected summary and inline finding shapes
- keep malformed output from crossing the parser boundary

Boundary:

- parser success still does not guarantee inline publishing
- findings must still pass snippet validation before inline publication

### `src/review/formatSummary.ts`

Deterministic summary-comment formatter.

The formatted summary includes:

- PR metadata
- included and excluded file counts
- excluded reason summary
- truncation summary
- context status
- AI review status
- validated summary findings
- downgraded inline findings

Boundary:

- formatting only
- no GitHub API calls

### `src/review/publishSummary.ts`

Summary publishing wrapper around comment upsert.

Boundary:

- converts structured summary data into one marker-based PR comment
- does not decide finding validity

### `src/review/publishInline.ts`

Publishes already-validated inline comments.

Boundary:

- best-effort publication only
- publish failure downgrades findings instead of failing the whole review flow

### `src/utils/*`

Cross-cutting utilities.

- `logger.ts`
  - redacts common tokens and authorization headers before logging
- `errors.ts`
  - safe error message extraction

## Actual Data Flow

Current implemented orchestration is:

```text
GitHub Actions pull_request runtime
  -> collectPullRequestContextFromRuntime()
  -> collectPullRequestContext()
PR context
  -> filterPullRequestFiles()
  -> buildReviewContext()
  -> llmClient.requestStructuredReview()
  -> parseStructuredReview()
  -> matchCandidateInlineFindings()
  -> publishValidatedInlineComments()
  -> publishDeterministicSummary()
```

## End-To-End Flow Details

### 1. Configuration Load

`run()` loads reviewer config first.

Source:

- `.ai-pr-review.yml` if present
- defaults otherwise

Failure mode:

- invalid YAML or invalid schema throws and fails the run safely

### 2. PR Context Entry

The review workflow requires:

- PR metadata
- changed files with patch information

Current repository reality:

- these structures are fully modeled and tested
- the default runtime path checks `GITHUB_EVENT_NAME`
- non-`pull_request` events return `undefined` and skip safely
- `pull_request` events require `GITHUB_EVENT_PATH`
- the runtime reads the event payload JSON, resolves repository metadata, requires `GITHUB_TOKEN`, and then calls `collectPullRequestContext()`
- changed files are fetched from the GitHub pull request files API with `perPage = 100`

### 3. Diff Filtering

Reviewable input is reduced before any AI request.

Current exclusion reasons:

- `deleted`
- `missing_patch`
- `configured_exclude`
- `generated`
- `lock_file`
- `minified`
- `docs_only`

Current truncation behavior:

- patch truncation happens per included file
- included file count may be capped by config

### 4. Review Context Assembly

The context builder converts structured inputs into deterministic text sections.

Important current behavior:

- full file context is off by default
- even when requested, it can fall back to patch-only mode for:
  - disabled config
  - missing file reader
  - PR too large
  - file read failure

Current explicit safety limits for full file context:

- at most 5 included files
- at most 12000 total included patch characters

### 5. LLM Request

The OpenAI client sends:

- a fixed system instruction
- a single assembled user prompt
- `response_format.type = json_object`

Current degradation states:

- `missing_api_key`
- `timeout`
- `rate_limit`
- `provider_response_invalid`
- `request_failed`

Runtime startup also has explicit failure or skip boundaries before the LLM stage:

- non-`pull_request` event: skip
- missing `GITHUB_EVENT_PATH`: fail
- invalid event payload JSON: fail
- missing PR payload metadata: fail
- missing `GITHUB_TOKEN` for changed-file collection: fail

### 6. Parser Boundary

The parser is the trust boundary between provider output and publishing.

Current rule:

- if parsing or structural validation fails, raw model output is discarded and only degraded summary status is published

### 7. Inline Validation

Inline findings are validated after parsing.

A finding becomes inline-eligible only when:

- confidence meets the configured threshold
- the target file exists in included patches
- the snippet matches an added line
- the max inline comment cap is not exceeded

Otherwise, it is downgraded into summary output.

### 8. Publish Order

Current publish order is intentional:

1. try validated inline comments first
2. collect any publish failures as downgraded findings
3. publish or update the summary comment

Why this order matters:

- the summary can report downgraded inline findings from the same run
- inline failures do not block summary publication

## Summary Upsert Model

The summary comment uses marker-based upsert:

```html
<!-- ai-pr-review-assistant -->
```

Current algorithm:

1. list existing PR issue comments
2. find the first bot-authored comment containing the marker
3. update that comment if found
4. otherwise create a new comment

This gives deterministic rerun behavior for the summary layer.

## Failure And Safety Model

Current safety rules:

- secrets must be redacted in logs
- non-`pull_request` events must not pretend to review a PR
- applicable but unavailable runtime inputs must fail clearly instead of running an empty review
- raw LLM output must never be published
- invalid inline findings must not be published inline
- inline publish failure must not fail the whole Action
- missing tokens or provider failures degrade safely instead of leaking partial untrusted content

## Third-Party Dependencies

Package dependencies currently in use:

- `yaml`
  - config parsing
- `typescript`
  - compilation
- `vitest`
  - tests
- `@types/node`
  - TypeScript Node types

External APIs currently called by implementation:

- GitHub REST API
- OpenAI Chat Completions API

Not present in `package.json` today:

- `@actions/core`
- `@actions/github`
- `reviewdog`
- GitHub SDK wrappers
- glob libraries

That absence is important because it explains current boundaries:

- GitHub Action runtime collection is implemented through local fetch-based helpers rather than GitHub SDK helpers
- exclude matching is implemented manually rather than through a glob package

## Known Architectural Limitations

- runtime support is limited to GitHub `pull_request` events
- PR context collection depends on readable event payload JSON and `GITHUB_TOKEN`
- full file context depends on a provided reader and strict safety caps
- current exclude matching is intentionally simple
- current inline validation is exact-snippet based and patch-only
- current summary is the stable core path; inline remains best-effort

## Related Documents

- overview and setup: [README.md](/E:/牛牛/README.md)
- demo walkthrough and checklist: [docs/demo-guide.md](/E:/牛牛/docs/demo-guide.md)
