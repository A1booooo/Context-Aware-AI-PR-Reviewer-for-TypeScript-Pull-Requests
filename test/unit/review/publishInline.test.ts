import { describe, expect, it, vi } from 'vitest';

import { publishValidatedInlineComments } from '../../../src/review/publishInline';
import type { GitHubCommentsClient } from '../../../src/github/comments';
import type { PullRequestMetadata } from '../../../src/github/pr';
import type { ValidatedInlineFinding } from '../../../src/diff/matchSnippet';

function createMetadataFixture(): PullRequestMetadata {
  return {
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
      ref: 'feature/task-10',
      sha: 'head-sha'
    }
  };
}

function createValidatedInlineFinding(): ValidatedInlineFinding {
  return {
    title: 'Guard overflow before incrementing the counter.',
    severity: 'high',
    confidence: 0.93,
    file: 'src/feature.ts',
    codeSnippet: 'const nextCount = count + 1;',
    path: 'src/feature.ts',
    line: 11
  };
}

function createCommentsClientFixture(): GitHubCommentsClient {
  return {
    listPullRequestComments: vi.fn(async () => ({ data: [] })),
    createIssueComment: vi.fn(async () => ({
      id: 999,
      body: '',
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    })),
    updateIssueComment: vi.fn(async () => ({
      id: 999,
      body: '',
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    })),
    createPullRequestReviewComment: vi.fn(async ({ body, path, line }) => ({
      id: 123,
      body,
      path,
      line,
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    }))
  };
}

describe('publishValidatedInlineComments', () => {
  it('publishes validated inline findings to the pull request review comments api', async () => {
    const client = createCommentsClientFixture();
    const finding = createValidatedInlineFinding();

    const result = await publishValidatedInlineComments({
      metadata: createMetadataFixture(),
      findings: [finding],
      client
    });

    expect(client.createPullRequestReviewComment).toHaveBeenCalledTimes(1);
    expect(client.createPullRequestReviewComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42,
      commitId: 'head-sha',
      path: 'src/feature.ts',
      line: 11,
      side: 'RIGHT',
      body: '[high] Guard overflow before incrementing the counter. (confidence 0.93)'
    });
    expect(result.publishedFindings).toEqual([finding]);
    expect(result.downgradedFindings).toEqual([]);
  });

  it('degrades findings to summary-safe file-level entries when inline publishing fails, including 422 responses', async () => {
    const client = createCommentsClientFixture();
    const finding = createValidatedInlineFinding();

    vi.mocked(client.createPullRequestReviewComment).mockRejectedValueOnce(
      Object.assign(new Error('Unprocessable Entity'), { status: 422 })
    );

    const result = await publishValidatedInlineComments({
      metadata: createMetadataFixture(),
      findings: [finding],
      client
    });

    expect(result.publishedFindings).toEqual([]);
    expect(result.downgradedFindings).toEqual([
      expect.objectContaining({
        title: 'Guard overflow before incrementing the counter.',
        file: 'src/feature.ts',
        reason: 'publish_failed'
      })
    ]);
  });
});
