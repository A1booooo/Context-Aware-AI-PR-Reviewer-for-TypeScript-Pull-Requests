# Context-Aware AI PR Reviewer Tasks

This task list converts the project plan into small PR-sized implementation tasks. Work through it in order. Do not implement future tasks early.

## Priority

The first milestone is a stable GitHub Action PR summary comment loop:

1. Runnable TypeScript GitHub Action scaffold.
2. Pull request metadata and changed file collection.
3. Diff filtering and truncation.
4. Deterministic summary formatting and summary comment upsert.

LLM integration and inline comments come later.

---

## Task 1: Initialize Runnable TypeScript GitHub Action

**Goal**

Create the minimal TypeScript GitHub Action project structure so the Action can start on pull request events and run tests/builds locally.

**Scope**

- Add Node.js + TypeScript project files.
- Add Action metadata.
- Add a minimal `src/main.ts` entrypoint.
- Add a basic test setup.
- Add CI workflow for install, test, and build.
- Add only minimal startup and error boundary logic. Event-specific pull request handling should stay minimal and must not fetch PR data yet.

**Out of Scope**

- Fetching pull request files.
- Posting GitHub comments.
- Loading reviewer configuration.
- Calling any LLM API.
- Inline comments.

**Acceptance Criteria**

- `npm test` passes.
- `npm run build` passes.
- Action metadata points to the built entrypoint.
- `src/main.ts` is small and only handles startup/error boundaries.
- No secrets or tokens are logged.

**Verification Commands**

```bash
npm install
npm test
npm run build
```

**Expected Changed Files**

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vitest.config.ts`
- `action.yml`
- `.github/workflows/ci.yml`
- `src/main.ts`
- `src/utils/logger.ts`
- `src/utils/errors.ts`
- `test/unit/main.test.ts`

---

## Task 2: Fetch Pull Request Metadata and Changed Files

**Goal**

Fetch pull request metadata and changed files, including patches, through a small GitHub client layer.

**Scope**

- Add a GitHub client wrapper.
- Read PR owner, repo, pull number, title, body, base, head, and author from the event context.
- Fetch changed files with pagination.
- Preserve file status, filename, additions, deletions, changes, and patch when available.
- Skip or mark files with missing patches, binary files, and deleted files so later steps can ignore them safely.
- Add unit tests with mocked GitHub responses.

**Out of Scope**

- Config loading.
- Diff filtering rules beyond safe classification.
- Summary comment publishing.
- LLM review.
- Inline comments.

**Acceptance Criteria**

- Pull request metadata is returned in an explicit typed shape.
- Changed files are paginated until all pages are fetched.
- Missing patch, binary-like files, and deleted files do not crash the Action.
- Tests cover pagination and skipped file classification.

**Verification Commands**

```bash
npm test -- test/unit/github
npm run build
```

**Expected Changed Files**

- `src/github/client.ts`
- `src/github/pr.ts`
- `test/unit/github/pr.test.ts`
- `test/fixtures/githubChangedFiles.ts`

---

## Task 3: Add Diff Filtering and Patch Truncation

**Goal**

Filter noisy files and truncate large patches before any review context or comment is generated.

**Scope**

- Filter generated outputs, lock files, minified files, docs-only changes, deleted files, and files without usable patches.
- Add patch truncation by maximum characters per file.
- Return truncation metadata for summary comments.
- Keep functions pure and unit-testable.

**Out of Scope**

- Loading `.ai-pr-review.yml`.
- Fetching full file contents.
- LLM prompts.
- Publishing comments.

**Acceptance Criteria**

- Default excludes include common generated, lock, and minified files.
- Truncated patches include clear metadata but no malformed patch strings.
- Tests cover excluded files, skipped files, docs-only changes, and truncation.
- No dependencies are added unless clearly justified.

**Verification Commands**

```bash
npm test -- test/unit/diff
npm run build
```

**Expected Changed Files**

- `src/diff/filterFiles.ts`
- `src/diff/truncatePatch.ts`
- `test/unit/diff/filterFiles.test.ts`
- `test/unit/diff/truncatePatch.test.ts`
- `test/fixtures/diffFiles.ts`

---

## Task 4: Publish Deterministic PR Summary Comment

**Goal**

Create and update a stable PR summary comment using a fixed marker, without LLM integration.

**Scope**

- Format a deterministic summary from PR metadata, filtered files, skipped files, and truncation metadata.
- Add summary comment publishing with upsert behavior.
- Find the previous bot comment by marker and update it.
- Create a new summary comment only when no marker comment exists.
- Use built-in default limits and exclude rules from previous diff utilities. Do not depend on `.ai-pr-review.yml` yet.
- Keep failures clear and avoid leaking tokens.

**Out of Scope**

- LLM-generated findings.
- Inline comments.
- Config loading.
- Full file context.

**Acceptance Criteria**

- Summary includes the fixed marker `<!-- ai-pr-review-assistant -->`.
- Re-running updates the prior marker comment instead of creating duplicates.
- Tests cover create and update paths.
- The Action can run the summary loop on a pull request.

**Verification Commands**

```bash
npm test -- test/unit/review
npm run build
```

**Expected Changed Files**

- `src/review/formatSummary.ts`
- `src/review/publishSummary.ts`
- `src/github/comments.ts`
- `src/main.ts`
- `test/unit/review/formatSummary.test.ts`
- `test/unit/review/publishSummary.test.ts`

---

## Task 5: Add Reviewer Configuration Loading

**Goal**

Load `.ai-pr-review.yml` with safe defaults and validate supported configuration fields.

**Scope**

- Add config schema and loader.
- Support `language`, `max_files`, `max_patch_chars_per_file`, `include_full_file_context`, `exclude`, and `review` options.
- Merge repo config with defaults.
- Reject invalid config with a clear summary-safe message.
- Add README documentation for configuration.

**Out of Scope**

- LLM usage.
- Inline comments.
- Advanced glob behavior beyond what this task explicitly tests.

**Acceptance Criteria**

- Missing config uses defaults.
- Invalid config fails clearly without logging secrets.
- Exclude patterns influence diff filtering.
- Tests cover defaults, valid config, invalid config, and exclude merging.

**Verification Commands**

```bash
npm test -- test/unit/config test/unit/diff
npm run build
```

**Expected Changed Files**

- `src/config/schema.ts`
- `src/config/loadConfig.ts`
- `src/diff/filterFiles.ts`
- `src/main.ts`
- `test/unit/config/loadConfig.test.ts`
- `README.md`

---

## Task 6: Build Review Context Without LLM Calls

**Goal**

Build the structured review context that will later be sent to an LLM, while keeping output deterministic and testable.

**Scope**

- Combine PR metadata, filtered patch diff, truncation notes, config, and review focus into a structured context object.
- Include full file context only when enabled and safe within limits.
- Use patch-only context for large PRs or unavailable file contents.
- Add TypeScript/React review focus text as deterministic context.

**Out of Scope**

- Calling an LLM API.
- Parsing LLM output.
- Inline comments.
- New summary publishing behavior beyond reporting context/truncation status.

**Acceptance Criteria**

- Context builder returns stable sections: pull request metadata, patch diff, optional full file context, review focus, and output schema instructions.
- Large PR behavior is deterministic and documented in returned metadata.
- Tests cover small PR full context, large PR patch-only context, and disabled full context.

**Verification Commands**

```bash
npm test -- test/unit/context
npm run build
```

**Expected Changed Files**

- `src/context/buildReviewContext.ts`
- `src/github/pr.ts`
- `src/review/formatSummary.ts`
- `test/unit/context/buildReviewContext.test.ts`
- `test/fixtures/reviewContext.ts`

---

## Task 7: Parse and Validate Structured Review Results

**Goal**

Define the review result schema and parse structured JSON safely before any publishing uses it.

**Scope**

- Add review result types/schema.
- Strip markdown code fences from model-like output.
- Parse JSON into validated summary findings and candidate inline findings.
- Enforce severity, confidence, and required fields.
- Degrade malformed output into a summary-safe parse error result.

**Out of Scope**

- Calling a real LLM API.
- Publishing inline comments.
- Matching snippets to patches.

**Acceptance Criteria**

- Valid JSON parses into a typed review result.
- Code-fenced JSON parses correctly.
- Malformed JSON never throws past the parser boundary.
- Invalid findings are excluded or downgraded according to tests.

**Verification Commands**

```bash
npm test -- test/unit/llm
npm run build
```

**Expected Changed Files**

- `src/llm/schema.ts`
- `src/llm/parseReview.ts`
- `test/unit/llm/parseReview.test.ts`
- `test/fixtures/llmOutputs.ts`

---

## Task 8: Integrate LLM Review for Summary Only

**Goal**

Call a real LLM API to produce validated structured results and publish only the summary comment.

**Scope**

- Add an LLM client boundary.
- Read the API key from environment or Action inputs without logging it.
- Send the structured review context.
- Parse and validate the returned JSON.
- Publish validated findings in the summary comment.
- Handle missing API key, fork PR secrets, timeout, rate limit, and malformed output with clear summary behavior.

**Out of Scope**

- Inline comments.
- Snippet matching.
- Multi-provider LLM abstraction unless required by the current API choice.

**Acceptance Criteria**

- Missing API key produces a clear summary-safe failure or skip message.
- LLM output is parsed and validated before summary publishing.
- Malformed LLM output does not publish raw untrusted content.
- Tests mock the LLM boundary and cover success and degradation paths.

**Verification Commands**

```bash
npm test -- test/unit/llm test/unit/review
npm run build
```

**Expected Changed Files**

- `src/llm/client.ts`
- `src/main.ts`
- `src/review/formatSummary.ts`
- `test/unit/llm/client.test.ts`
- `test/unit/main.test.ts`
- `README.md`

---

## Task 9: Match Candidate Inline Findings to Added Patch Lines

**Goal**

Validate candidate inline findings against added lines in the patch before any inline publishing exists.

**Scope**

- Match `file + code_snippet` against added lines in changed file patches.
- Return GitHub-ready file and line metadata only for validated matches.
- Downgrade unmatched findings to file-level summary findings.
- Enforce confidence threshold and maximum inline candidate count.

**Out of Scope**

- Publishing inline comments to GitHub.
- Changing LLM prompt shape beyond consuming already parsed candidate findings.
- Large-scale fuzzy matching.

**Acceptance Criteria**

- Findings only validate when snippets match added lines.
- Findings for deleted, unchanged, or context lines are not inline-eligible.
- Unmatched findings are available for summary output.
- Tests cover exact match, no match, wrong file, low confidence, and max count.

**Verification Commands**

```bash
npm test -- test/unit/diff
npm run build
```

**Expected Changed Files**

- `src/diff/matchSnippet.ts`
- `src/review/formatSummary.ts`
- `test/unit/diff/matchSnippet.test.ts`
- `test/fixtures/patches.ts`

---

## Task 10: Publish Validated Inline Comments With Summary Degradation

**Goal**

Publish only validated inline comments and degrade failures into the summary comment without failing the whole Action.

**Scope**

- Add inline publishing for validated findings.
- Publish at most the configured inline comment limit.
- Catch GitHub inline publishing failures, including 422 responses.
- Add failed inline findings to the summary as file-level findings.
- Keep summary publishing as the reliable final output.

**Out of Scope**

- New LLM behavior.
- Broader review categories.
- Reviewdog or alternative publishing integrations.

**Acceptance Criteria**

- Inline comments are never attempted unless snippet validation succeeded against added patch lines.
- Inline publishing failure does not fail the whole Action.
- Summary still publishes and includes degraded findings.
- Tests cover successful inline publishing and failure degradation.

**Verification Commands**

```bash
npm test -- test/unit/review test/unit/diff
npm run build
```

**Expected Changed Files**

- `src/review/publishInline.ts`
- `src/review/publishSummary.ts`
- `src/main.ts`
- `test/unit/review/publishInline.test.ts`
- `test/unit/main.test.ts`

---

## Task 11: Add Curated Review Fixtures

**Goal**

Add demo fixtures that demonstrate common TypeScript/React PR risks and expected findings.

**Scope**

- Add fixture diffs for auth bug, React hook stale closure, missing error handling, and unsafe token handling.
- Add expected findings JSON for each fixture.
- Add fixture validation tests that ensure fixtures are readable and expected finding shapes match the parser schema.

**Out of Scope**

- Guaranteeing the LLM always finds every fixture issue.
- Inline publishing changes.
- Demo video production.

**Acceptance Criteria**

- Each fixture has a diff and expected findings file.
- Fixture tests pass locally.
- Fixtures are referenced in README or demo guide.

**Verification Commands**

```bash
npm test -- test/unit/fixtures test/unit/llm
npm run build
```

**Expected Changed Files**

- `demo/fixtures/pr-1-auth-bug.diff`
- `demo/fixtures/pr-1-auth-bug.expected.json`
- `demo/fixtures/pr-2-react-effect-bug.diff`
- `demo/fixtures/pr-2-react-effect-bug.expected.json`
- `demo/fixtures/pr-3-error-handling.diff`
- `demo/fixtures/pr-3-error-handling.expected.json`
- `demo/fixtures/pr-4-token-storage.diff`
- `demo/fixtures/pr-4-token-storage.expected.json`
- `test/unit/fixtures/demoFixtures.test.ts`
- `README.md`

---

## Task 12: Complete README, Architecture Notes, and Demo Guide

**Goal**

Document how the Action works, how to configure it, what it depends on, and how to demonstrate it.

**Scope**

- Add project positioning and boundaries with ESLint, TypeScript, CodeQL, and reviewdog.
- Document architecture and processing flow.
- Add GitHub Action workflow example.
- Add `.ai-pr-review.yml` example.
- Document secrets setup.
- List third-party dependencies and their purpose.
- Document prompt strategy, truncation, failure degradation, fixtures, limitations, and future improvements.
- Add demo video checklist or guide.

**Out of Scope**

- Implementing new runtime behavior.
- Recording the actual demo video unless requested as a separate task.
- Adding support for non-GitHub platforms.

**Acceptance Criteria**

- README is sufficient for a new user to install and run the Action.
- README clearly identifies original project code and third-party dependencies.
- Demo guide covers summary upsert, configuration, inline/file-level degradation, and multiple small PRs.
- Documentation matches implemented behavior only.

**Verification Commands**

```bash
npm test
npm run build
```

**Expected Changed Files**

- `README.md`
- `docs/architecture.md`
- `docs/demo-guide.md`
