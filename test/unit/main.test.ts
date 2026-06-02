import { describe, expect, it, vi } from 'vitest';

import {
  run,
  runDeterministicSummaryWorkflow
} from '../../src/main';
import { createLogger } from '../../src/utils/logger';
import type { PullRequestContext } from '../../src/github/pr';
import type { GitHubCommentsClient } from '../../src/github/comments';

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

describe('run', () => {
  it('logs startup and completion for the minimal action flow', async () => {
    const info = vi.fn();
    const error = vi.fn();

    await run({
      logger: { info, error },
      startup: vi.fn(async () => undefined)
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
        })
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

    await run({
      logger: { info, error },
      startup: vi.fn(async () => createPullRequestContextFixture()),
      createCommentsClient
    });

    expect(createCommentsClient).toHaveBeenCalledTimes(1);
    expect(commentsClient.createIssueComment).toHaveBeenCalledTimes(1);
    expect(info).toHaveBeenCalledWith(
      'Deterministic pre-LLM summary comment created for PR #42.'
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
      createCommentsClient
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
      startup: vi.fn(async () => createPullRequestContextFixture())
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

    const result = await runDeterministicSummaryWorkflow({
      logger: { info, error },
      pullRequestContext: createPullRequestContextFixture(),
      commentsClient
    });

    expect(result.action).toBe('created');
    expect(commentsClient.createIssueComment).toHaveBeenCalledTimes(1);
    expect(commentsClient.createIssueComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'review-repo',
      issueNumber: 42,
      body: expect.stringContaining('Included files count: 1')
    });
    expect(info).toHaveBeenCalledWith(
      'Deterministic pre-LLM summary comment created for PR #42.'
    );
    expect(commentsClient.updateIssueComment).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });
});
