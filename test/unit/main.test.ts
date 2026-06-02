import { describe, expect, it, vi } from 'vitest';

import {
  run,
  runDeterministicSummaryWorkflow
} from '../../src/main';
import { createLogger } from '../../src/utils/logger';
import type { PullRequestContext } from '../../src/github/pr';
import type { GitHubCommentsClient } from '../../src/github/comments';
import type { ReviewerConfig } from '../../src/config/schema';
import type { LlmReviewClient } from '../../src/llm/client';
import {
  createMalformedReviewJsonOutput,
  createValidReviewJsonOutput
} from '../fixtures/llmOutputs';

function createPullRequestContextFixture(): PullRequestContext {
  return {
    metadata: {
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42,
      title: 'Improve file loading',
      body: 'This updates the file collection flow.',
      author: 'contributor',
      base: {
        ref: 'main',
        sha: 'base-sha'
      },
      head: {
        ref: 'feature/task-4',
        sha: 'head-sha'
      }
    },
    files: [
      {
        filename: 'src/feature.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1 +1 @@\n-old\n+new'
      },
      {
        filename: 'docs/usage.md',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1 +1 @@\n-old\n+new'
      }
    ]
  };
}

function createCommentsClientFixture(): GitHubCommentsClient {
  return {
    listPullRequestComments: vi.fn(async () => ({ data: [] })),
    createIssueComment: vi.fn(async ({ body }: { body: string }) => ({
      id: 999,
      body,
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    })),
    updateIssueComment: vi.fn(async ({ commentId, body }: { commentId: number; body: string }) => ({
      id: commentId,
      body,
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    }))
  };
}

function createReviewerConfigFixture(
  overrides: Partial<ReviewerConfig> = {}
): ReviewerConfig {
  return {
    language: 'zh-CN',
    max_files: 20,
    max_patch_chars_per_file: 6000,
    include_full_file_context: false,
    exclude: [],
    review: {
      severity_threshold: 'medium',
      max_inline_comments: 5,
      confidence_threshold: 0.75,
      focus: ['bug-risk']
    },
    ...overrides
  };
}

function createLlmClientFixture(
  outputText: string = createValidReviewJsonOutput()
): LlmReviewClient {
  return {
    requestStructuredReview: vi.fn(async () => ({
      status: 'success',
      outputText
    }))
  };
}

describe('run', () => {
  it('logs startup and completion for the minimal action flow', async () => {
    const info = vi.fn();
    const error = vi.fn();

    await run({
      logger: { info, error },
      startup: vi.fn(async () => undefined),
      loadConfig: vi.fn(() => createReviewerConfigFixture())
    });

    expect(info).toHaveBeenCalledWith('Action starting.');
    expect(info).toHaveBeenCalledWith('Action finished successfully.');
    expect(error).not.toHaveBeenCalled();
  });

  it('logs a safe error message and rethrows startup failures', async () => {
    const info = vi.fn();
    const error = vi.fn();

    await expect(
      run({
        logger: { info, error },
        startup: vi.fn(async () => {
          throw new Error('Authorization: Bearer super-secret-token');
        }),
        loadConfig: vi.fn(() => createReviewerConfigFixture())
      })
    ).rejects.toThrow('Authorization: Bearer super-secret-token');

    expect(error).toHaveBeenCalledWith(
      'Action failed: Authorization: [REDACTED]'
    );
  });

  it('publishes the deterministic summary when startup returns pull request context', async () => {
    const info = vi.fn();
    const error = vi.fn();
    const commentsClient = createCommentsClientFixture();
    const createCommentsClient = vi.fn(() => commentsClient);
    const createLlmClient = vi.fn(() => createLlmClientFixture());

    await run({
      logger: { info, error },
      startup: vi.fn(async () => createPullRequestContextFixture()),
      createCommentsClient,
      createLlmClient,
      loadConfig: vi.fn(() => createReviewerConfigFixture())
    });

    expect(createCommentsClient).toHaveBeenCalledTimes(1);
    expect(createLlmClient).toHaveBeenCalledTimes(1);
    expect(commentsClient.createIssueComment).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      'Summary review comment created for PR #42.'
    );
    expect(info).toHaveBeenCalledWith('Action finished successfully.');
    expect(error).not.toHaveBeenCalled();
  });

  it('does not publish a comment when startup does not return pull request context', async () => {
    const info = vi.fn();
    const error = vi.fn();
    const createCommentsClient = vi.fn();

    await run({
      logger: { info, error },
      startup: vi.fn(async () => undefined),
      createCommentsClient,
      loadConfig: vi.fn(() => createReviewerConfigFixture())
    });

    expect(createCommentsClient).not.toHaveBeenCalled();
    expect(info).toHaveBeenCalledWith('Action finished successfully.');
    expect(error).not.toHaveBeenCalled();
  });

  it('skips deterministic summary publishing when GITHUB_TOKEN is missing', async () => {
    const originalToken = process.env.GITHUB_TOKEN;
    const originalOpenAiApiKey = process.env.OPENAI_API_KEY;
    const info = vi.fn();
    const error = vi.fn();

    process.env.OPENAI_API_KEY = 'super-secret-token';
    delete process.env.GITHUB_TOKEN;

    await run({
      logger: { info, error },
      startup: vi.fn(async () => createPullRequestContextFixture()),
      loadConfig: vi.fn(() => createReviewerConfigFixture())
    });

    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN;
    } else {
      process.env.GITHUB_TOKEN = originalToken;
    }
    if (originalOpenAiApiKey === undefined) {
      delete process.env.OPENAI_API_KEY;
    } else {
      process.env.OPENAI_API_KEY = originalOpenAiApiKey;
    }

    expect(info).toHaveBeenCalledWith(
      'Skipping deterministic summary publish because GITHUB_TOKEN is not configured.'
    );
    const loggedMessages = [
      ...info.mock.calls.flat(),
      ...error.mock.calls.flat()
    ];

    expect(loggedMessages).not.toContain('super-secret-token');
    expect(loggedMessages.join('\n')).not.toContain('super-secret-token');
  });
});

describe('createLogger', () => {
  it('redacts common token and authorization formats before writing logs', () => {
    const infoSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    const logger = createLogger();

    logger.info(
      'GITHUB_TOKEN=abc123 OPENAI_API_KEY=sk-test ANTHROPIC_API_KEY=anthropic-secret Authorization: Bearer xyz'
    );
    logger.error('Authorization: Bearer top-secret');

    expect(infoSpy).toHaveBeenCalledWith(
      'GITHUB_TOKEN=[REDACTED] OPENAI_API_KEY=[REDACTED] ANTHROPIC_API_KEY=[REDACTED] Authorization: [REDACTED]'
    );
    expect(errorSpy).toHaveBeenCalledWith('Authorization: [REDACTED]');

    infoSpy.mockRestore();
    errorSpy.mockRestore();
  });
});

describe('runDeterministicSummaryWorkflow', () => {
  it('keeps orchestration thin by filtering files and publishing the deterministic summary', async () => {
    const info = vi.fn();
    const error = vi.fn();
    const commentsClient = createCommentsClientFixture();
    const llmClient = createLlmClientFixture();

    const result = await runDeterministicSummaryWorkflow({
      logger: { info, error },
      pullRequestContext: createPullRequestContextFixture(),
      commentsClient,
      llmClient,
      config: createReviewerConfigFixture()
    });

    expect(result.action).toBe('created');
    expect(commentsClient.createIssueComment).toHaveBeenCalledTimes(1);
    expect(commentsClient.createIssueComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'review-repo',
      issueNumber: 42,
      body: expect.stringContaining('Validated AI findings:')
    });
    const createdBody = vi.mocked(commentsClient.createIssueComment).mock.calls[0]?.[0]?.body;
    expect(createdBody).toContain(
      '[high] Missing null guard before property access (confidence 0.92)'
    );
    expect(createdBody).not.toContain('useEffect(() => syncCount(count), [])');
    expect(info).toHaveBeenCalledWith(
      'Summary review comment created for PR #42.'
    );
    expect(commentsClient.updateIssueComment).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('applies max_files after diff filtering and max_patch_chars_per_file during truncation', async () => {
    const info = vi.fn();
    const error = vi.fn();
    const commentsClient = createCommentsClientFixture();
    const pullRequestContext = createPullRequestContextFixture();

    pullRequestContext.files = [
      {
        filename: 'docs/usage.md',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1 +1 @@\n-old\n+new'
      },
      {
        filename: 'src/one.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1,4 +1,4 @@\n-old line\n+new line\n+another line'
      },
      {
        filename: 'src/two.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1 +1 @@\n-old\n+new'
      }
    ];

    await runDeterministicSummaryWorkflow({
      logger: { info, error },
      pullRequestContext,
      commentsClient,
      llmClient: createLlmClientFixture(),
      config: createReviewerConfigFixture({
        max_files: 1,
        max_patch_chars_per_file: 20
      })
    });

    const firstCommentRequest = vi.mocked(
      commentsClient.createIssueComment
    ).mock.calls[0]?.[0];

    expect(firstCommentRequest).toEqual(
      expect.objectContaining({
        owner: 'octo-org',
        repo: 'review-repo',
        issueNumber: 42,
        body: expect.stringContaining('Included files count: 1')
      })
    );
    expect(firstCommentRequest?.body).toContain(
      'Truncated files summary:\n- src/one.ts'
    );
  });

  it('publishes a safe degradation summary when the model output is malformed', async () => {
    const info = vi.fn();
    const error = vi.fn();
    const commentsClient = createCommentsClientFixture();
    const unsafeModelOutput =
      `${createMalformedReviewJsonOutput()}\nAuthorization: Bearer leaked-token`;

    await runDeterministicSummaryWorkflow({
      logger: { info, error },
      pullRequestContext: createPullRequestContextFixture(),
      commentsClient,
      llmClient: createLlmClientFixture(unsafeModelOutput),
      config: createReviewerConfigFixture()
    });

    const createdBody = vi.mocked(commentsClient.createIssueComment).mock.calls[0]?.[0]?.body;

    expect(createdBody).toContain('AI review status:');
    expect(createdBody).toContain('- status: degraded');
    expect(createdBody).toContain('- reason: parse_error');
    expect(createdBody).toContain(
      'AI review degraded because the provider returned malformed structured JSON. Raw model output was discarded.'
    );
    expect(createdBody).not.toContain('leaked-token');
    expect(createdBody).not.toContain('Authorization: Bearer');
    expect(createdBody).not.toContain('{"summary_findings"');
    expect(createdBody).toContain('Validated AI findings:\n- none');
  });
});
