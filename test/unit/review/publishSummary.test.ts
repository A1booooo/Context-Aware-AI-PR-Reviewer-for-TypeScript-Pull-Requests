import { describe, expect, it, vi } from 'vitest';

import { publishDeterministicSummary } from '../../../src/review/publishSummary';
import type {
  GitHubIssueCommentApiResponse,
  PullRequestCommentsClient
} from '../../../src/github/client';
import type { PullRequestMetadata } from '../../../src/github/pr';
import { filterPullRequestFiles } from '../../../src/diff/filterFiles';
import {
  createDeletedFile,
  createMissingPatchFile,
  createTextPatchFile
} from '../../fixtures/diffFiles';

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
      ref: 'feature/task-4',
      sha: 'head-sha'
    }
  };
}

function createClientFixture(
  comments: GitHubIssueCommentApiResponse[]
): PullRequestCommentsClient<GitHubIssueCommentApiResponse> {
  return {
    listPullRequestComments: vi.fn(async () => ({ data: comments })),
    createIssueComment: vi.fn(async ({ body }) => ({
      id: 999,
      body,
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    })),
    updateIssueComment: vi.fn(async ({ commentId, body }) => ({
      id: commentId,
      body,
      user: {
        login: 'github-actions[bot]',
        type: 'Bot'
      }
    }))
  };
}

function createSummaryInput() {
  const filteredFiles = filterPullRequestFiles(
    [
      createTextPatchFile('src/feature.ts', '@@ -1 +1 @@\n-old\n+new'),
      createMissingPatchFile('assets/image.png'),
      createDeletedFile('src/obsolete.ts')
    ],
    { maxPatchCharacters: 20 }
  );

  return {
    metadata: createMetadataFixture(),
    includedFiles: filteredFiles.includedFiles,
    excludedFiles: filteredFiles.excludedFiles
  };
}

describe('publishDeterministicSummary', () => {
  it('updates an existing marker bot comment instead of creating a duplicate', async () => {
    const client = createClientFixture([
      {
        id: 123,
        body: '<!-- ai-pr-review-assistant -->\nOld summary',
        user: {
          login: 'github-actions[bot]',
          type: 'Bot'
        }
      }
    ]);

    const result = await publishDeterministicSummary({
      client,
      ...createSummaryInput()
    });

    expect(result.action).toBe('updated');
    expect(client.updateIssueComment).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).not.toHaveBeenCalled();
    expect(client.updateIssueComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'review-repo',
      commentId: 123,
      body: expect.stringContaining('<!-- ai-pr-review-assistant -->')
    });
  });

  it('creates a new marker comment when no existing marker bot comment is found', async () => {
    const client = createClientFixture([
      {
        id: 456,
        body: '<!-- ai-pr-review-assistant -->\nHuman note',
        user: {
          login: 'reviewer',
          type: 'User'
        }
      }
    ]);

    const result = await publishDeterministicSummary({
      client,
      ...createSummaryInput()
    });

    expect(result.action).toBe('created');
    expect(client.createIssueComment).toHaveBeenCalledTimes(1);
    expect(client.updateIssueComment).not.toHaveBeenCalled();
    expect(client.createIssueComment).toHaveBeenCalledWith({
      owner: 'octo-org',
      repo: 'review-repo',
      issueNumber: 42,
      body: expect.stringContaining('<!-- ai-pr-review-assistant -->')
    });
  });

  it('does not create a second comment when a marker bot comment already exists', async () => {
    const client = createClientFixture([
      {
        id: 789,
        body: '<!-- ai-pr-review-assistant -->\nCurrent summary',
        user: {
          login: 'github-actions[bot]',
          type: 'Bot'
        }
      },
      {
        id: 790,
        body: 'Another comment',
        user: {
          login: 'reviewer',
          type: 'User'
        }
      }
    ]);

    await publishDeterministicSummary({
      client,
      ...createSummaryInput()
    });

    expect(client.listPullRequestComments).toHaveBeenCalledTimes(1);
    expect(client.updateIssueComment).toHaveBeenCalledTimes(1);
    expect(client.createIssueComment).not.toHaveBeenCalled();
  });
});
