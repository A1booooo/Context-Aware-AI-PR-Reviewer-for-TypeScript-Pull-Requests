# Context-Aware AI PR Reviewer

A TypeScript GitHub Action project for pull request review summaries driven by structured AI output.

This repository currently contains:

- the diff filtering, truncation, review-context, LLM parsing, summary upsert, and inline-degradation modules
- the packaged GitHub Action entrypoint in [`action.yml`](/E:/牛牛/action.yml)
- unit tests and demo fixtures for the implemented review flow

This repository includes a wired default GitHub Action runtime for GitHub `pull_request` events. The default entrypoint reads the event context from the GitHub Actions environment, uses `GITHUB_TOKEN` to fetch changed files and patches, constructs a `PullRequestContext`, and then enters the existing review pipeline. This README only describes behavior that is implemented today.

## What This Project Is

The project is a context-aware PR reviewer for TypeScript-oriented pull requests. Its current implemented flow is:

1. on GitHub `pull_request` events, read `GITHUB_EVENT_NAME` and `GITHUB_EVENT_PATH`
2. load reviewer config from `.ai-pr-review.yml` or defaults
3. use `GITHUB_TOKEN` to read PR metadata and fetch changed files and patches
4. construct `PullRequestContext`
5. filter non-reviewable files and truncate oversized patches
6. build structured review context for an LLM
7. request structured JSON from the LLM
8. parse and validate the JSON before publishing anything
9. upsert a deterministic PR summary comment
10. attempt inline comments only for findings validated against added patch lines
11. degrade safely back to the summary when inline publishing fails

## What This Project Is Not

This project is not a replacement for static analysis or repository policy tools.

`ESLint`
: catches rule-based code style and bug patterns inside source files. This project instead reviews PR context and publishes a human-readable summary comment.

`TypeScript`
: catches type-system issues at compile time. This project complements it by reviewing changed code, patch context, and higher-level risk signals.

`CodeQL`
: performs semantic and security analysis across the codebase. This project is narrower and PR-oriented, with AI-generated findings that must still be validated before publishing.

`reviewdog`
: is a transport/orchestration layer for existing linters and analyzers. This project generates its own structured AI review summary rather than forwarding third-party linter output.

The intended relationship is complementary:

- keep `TypeScript`, `ESLint`, and `CodeQL` as deterministic gates
- use this Action for context-aware review summaries on changed code
- use `reviewdog` if you want to route linter output; use this project if you want an AI-produced PR review layer

## Current Capability Boundaries

Implemented today:

- default runtime startup for GitHub `pull_request` events
- summary comment upsert using a fixed marker
- repository-level config loading from `.ai-pr-review.yml`
- runtime PR context collection from `GITHUB_EVENT_NAME` and `GITHUB_EVENT_PATH`
- fetch-based changed-file collection with `GITHUB_TOKEN`
- diff filtering for deleted, missing-patch, generated, lock, minified, docs-only, and configured-exclude files
- patch truncation metadata
- review-context construction
- OpenAI request/timeout/rate-limit/failure handling
- structured JSON parsing and validation before publishing
- inline candidate validation against added patch lines
- inline publish degradation back into the summary comment
- demo fixtures for four small PR risk patterns

Not implemented in current checked-in runtime:

- support for GitLab, Gitee, or non-GitHub platforms
- recorded demo video artifacts
- additional package dependencies beyond the current `package.json`

## Repository Structure

The implementation follows the module boundaries defined in [`AGENTS.md`](/E:/牛牛/AGENTS.md):

```text
src/
  main.ts
  github/
  config/
  diff/
  context/
  llm/
  review/
  utils/
test/
demo/
docs/
```

Architecture details: [docs/architecture.md](/E:/牛牛/docs/architecture.md)

Demo walkthrough: [docs/demo-guide.md](/E:/牛牛/docs/demo-guide.md)

## Installation And Local Verification

Prerequisites:

- Node.js 20 or later
- npm

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm test
```

Build:

```bash
npm run build
```

On this Windows setup, if PowerShell blocks `npm.ps1`, use:

```bash
npm.cmd test
npm.cmd run build
```

## GitHub Action Packaging

The repository is packaged as a Node 20 GitHub Action:

- action metadata: [`action.yml`](/E:/牛牛/action.yml)
- built entrypoint: `dist/src/main.js`
- action input: `openai_api_key`

Current action metadata:

```yml
name: Context-Aware AI PR Reviewer
description: Minimal TypeScript GitHub Action scaffold for pull request review startup.
inputs:
  openai_api_key:
    description: OpenAI API key for summary-only AI review
    required: false
runs:
  using: node20
  main: dist/src/main.js
```

Important limitation:

- the packaged action entrypoint builds and runs through `dist/src/main.js`
- the default runtime is implemented for GitHub `pull_request` events only
- non-`pull_request` events are skipped safely
- missing event payload data, invalid event payload JSON, or missing `GITHUB_TOKEN` prevent PR context collection and fail clearly

## Example Workflow

Example consumer workflow:

```yml
name: AI PR Review

on:
  pull_request:
    types: [opened, synchronize, reopened]

jobs:
  ai-pr-review:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      pull-requests: write
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Run reviewer
        uses: your-org/ai-pr-review-assistant@main
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}
```

Why `pull-requests: write`:

- summary publishing uses issue comments on the pull request
- inline publishing uses pull request review comments

Why `contents: read`:

- the runtime reads pull request metadata and changed-file context from the GitHub event and API

## Reviewer Configuration

Repository-level config file: `.ai-pr-review.yml`

If the file is missing, the project uses these defaults from [`src/config/schema.ts`](/E:/牛牛/src/config/schema.ts):

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

Example config file:

```yml
language: zh-CN
max_files: 10
max_patch_chars_per_file: 4000
include_full_file_context: false
exclude:
  - vendor/**
  - snapshots/**
review:
  severity_threshold: medium
  max_inline_comments: 3
  confidence_threshold: 0.8
  focus:
    - bug-risk
    - security
    - react-hooks
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

Validation rules implemented today:

- unknown top-level or `review.*` fields fail validation
- `max_files` and `max_patch_chars_per_file` must be positive integers
- `include_full_file_context` must be boolean
- `exclude` and `review.focus` must be arrays of non-empty strings
- `review.max_inline_comments` must be a non-negative integer
- `review.confidence_threshold` must be between `0` and `1`
- user `exclude` patterns are merged on top of default exclude patterns

Current exclude matching is intentionally limited to what is implemented in [`src/diff/filterFiles.ts`](/E:/牛牛/src/diff/filterFiles.ts):

- exact path matches
- directory-prefix patterns ending in `/**`
- suffix patterns shaped like `*.ext`

It does not implement a full glob engine.

## Secrets Setup

Current runtime reads secrets from environment variables:

- `GITHUB_TOKEN`
- `OPENAI_API_KEY`
- fallback action input environment: `INPUT_OPENAI_API_KEY`

Recommended setup in GitHub:

1. use the built-in `${{ secrets.GITHUB_TOKEN }}` for GitHub comment publishing
2. create a repository secret named `OPENAI_API_KEY`
3. expose both values in the workflow step environment

Runtime expectations:

- the default runtime reads `GITHUB_EVENT_NAME`
- only GitHub `pull_request` events enter the review flow
- `pull_request` events require `GITHUB_EVENT_PATH`
- `GITHUB_TOKEN` is required to fetch changed files and patches
- `OPENAI_API_KEY` is required for AI review generation unless you expect an AI-skipped summary state

Fork-pull-request behavior to expect:

- OpenAI secrets may be unavailable on forked PRs
- when that happens, the LLM client returns a safe `missing_api_key` skip result
- the summary is designed to report a skip/degraded state instead of publishing raw model output

## Processing Strategy

### Prompt Strategy

The OpenAI client in [`src/llm/client.ts`](/E:/牛牛/src/llm/client.ts) currently:

- sends a system instruction that demands JSON only
- includes a fixed schema shape for `summary_findings` and `inline_findings`
- sends the assembled review context as the user message
- requests `response_format.type = json_object`
- uses model `gpt-4.1-mini`

The prompt strategy is intentionally conservative:

- tell the model not to wrap JSON in markdown fences
- tell the model not to invent files or runtime behavior
- keep review focus deterministic from config and context metadata

### Truncation Strategy

The diff layer truncates oversized patches per file before review-context assembly.

Implemented behavior:

- each included file keeps at most `max_patch_chars_per_file`
- truncation metadata is preserved per file
- the summary comment reports which files were truncated
- review-context metadata records truncation notes

This repository does not claim token-aware truncation or semantic chunking. The current implementation is character-count based.

### Failure Degradation Strategy

Implemented degradation rules:

- non-`pull_request` event: skip safely without entering the review flow
- missing `GITHUB_EVENT_PATH` on a `pull_request` event: fail clearly
- invalid GitHub event payload JSON: fail clearly
- missing PR payload metadata on a `pull_request` event: fail clearly
- missing `GITHUB_TOKEN` during PR context collection: fail clearly
- missing OpenAI API key: mark AI review as `skipped`
- timeout, rate limit, invalid provider response, or failed request: mark AI review as `degraded`
- malformed or invalid structured JSON: discard raw model output and degrade safely
- unmatched inline findings: downgrade into summary output
- inline publish failures: downgrade the affected inline findings into the summary output

The core safety rule is simple:

- raw model output is never published
- only validated summary findings are shown as AI findings
- inline comments are attempted only after snippet-to-added-line validation

## Summary Upsert Behavior

Summary publishing uses a fixed marker:

```html
<!-- ai-pr-review-assistant -->
```

The summary publisher:

- lists existing PR issue comments
- finds a bot-authored comment containing the marker
- updates it if present
- creates a new summary comment if absent

This keeps reruns idempotent at the summary-comment level.

## Inline Comment Boundary

Inline publishing is a later-stage enhancement, but some of it is already implemented.

Implemented today:

- inline candidates must match added patch lines in the changed file
- low-confidence or unmatched findings are downgraded
- if GitHub inline publishing fails for a validated finding, that finding is downgraded instead of failing the whole Action

Not claimed here:

- guaranteed inline publishing for every valid finding
- multi-line inline ranges
- any behavior beyond current added-line matching and per-comment publish attempts

## Original Project Code And Third-Party Dependencies

Original project code in this repository:

- `src/config/*`
- `src/context/*`
- `src/diff/*`
- `src/github/*`
- `src/llm/*`
- `src/review/*`
- `src/utils/*`
- `src/main.ts`
- `test/*`
- `demo/fixtures/*`

Third-party packages from `package.json`:

- `yaml`
  - runtime dependency used to parse `.ai-pr-review.yml`
- `typescript`
  - compiler used for building the action
- `vitest`
  - test runner for unit and fixture validation tests
- `@types/node`
  - Node.js TypeScript type definitions

External services used by the implemented flow:

- GitHub REST API for issue comments and pull request review comments
- OpenAI Chat Completions API for structured review generation

## Demo Fixtures

Available fixtures under [`demo/fixtures`](/E:/牛牛/demo/fixtures):

- `pr-1-auth-bug`
- `pr-2-react-effect-bug`
- `pr-3-error-handling`
- `pr-4-token-storage`

Each fixture has:

- a `.diff` file
- a matching `.expected.json`

These fixtures are validated by [`test/unit/fixtures/demoFixtures.test.ts`](/E:/牛牛/test/unit/fixtures/demoFixtures.test.ts).

Demo usage guidance: [docs/demo-guide.md](/E:/牛牛/docs/demo-guide.md)

## Risks And Limitations

- The runtime supports GitHub `pull_request` events only.
- Non-`pull_request` events are skipped by design.
- Missing `GITHUB_EVENT_PATH`, invalid event payloads, or missing `GITHUB_TOKEN` prevent PR context collection and fail the run clearly.
- Current exclude matching is intentionally limited and is not a full glob implementation.
- Full file context is optional and guarded by explicit safety limits.
- Current full-file-context mode also depends on a file reader being provided.
- Inline comments depend on exact snippet matching against added patch lines.
- Provider-side AI quality is not guaranteed; the repository only guarantees parse/validation and safe degradation behavior around it.
- The repository currently supports GitHub only.

## Future Improvements

These are not implemented today:

- broader workflow packaging for direct consumer adoption
- richer exclusion matching
- more advanced prompt/token budgeting
- broader demo automation or recorded demos

## Documentation Map

- project overview and setup: [`README.md`](/E:/牛牛/README.md)
- module boundaries and data flow: [docs/architecture.md](/E:/牛牛/docs/architecture.md)
- demo scenarios and checklist: [docs/demo-guide.md](/E:/牛牛/docs/demo-guide.md)
