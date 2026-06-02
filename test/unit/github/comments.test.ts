import { afterEach, describe, expect, it, vi } from 'vitest';

import { createGitHubCommentsClientFromToken } from '../../../src/github/comments';

describe('createGitHubCommentsClientFromToken', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('lists pull request issue comments through the GitHub REST API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [{ id: 1, body: 'Existing comment' }]
    }));

    vi.stubGlobal('fetch', fetchMock);

    const client = createGitHubCommentsClientFromToken('test-token');

    const result = await client.listPullRequestComments({
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42
    });

    expect(result.data).toEqual([{ id: 1, body: 'Existing comment' }]);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octo-org/review-repo/issues/42/comments',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer test-token'
        })
      })
    );
  });

  it('creates a pull request issue comment through the GitHub REST API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 2, body: 'New comment' })
    }));

    vi.stubGlobal('fetch', fetchMock);

    const client = createGitHubCommentsClientFromToken('test-token');

    await client.createIssueComment({
      owner: 'octo-org',
      repo: 'review-repo',
      issueNumber: 42,
      body: 'New comment'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octo-org/review-repo/issues/42/comments',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ body: 'New comment' })
      })
    );
  });

  it('updates a pull request issue comment through the GitHub REST API', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => ({ id: 3, body: 'Updated comment' })
    }));

    vi.stubGlobal('fetch', fetchMock);

    const client = createGitHubCommentsClientFromToken('test-token');

    await client.updateIssueComment({
      owner: 'octo-org',
      repo: 'review-repo',
      commentId: 1001,
      body: 'Updated comment'
    });

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octo-org/review-repo/issues/comments/1001',
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ body: 'Updated comment' })
      })
    );
  });
});
