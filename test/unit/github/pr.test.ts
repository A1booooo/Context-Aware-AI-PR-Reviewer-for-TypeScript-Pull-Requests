import { describe, expect, it, vi } from 'vitest';

import {
  collectPullRequestContext,
  getPullRequestMetadata,
  type GitHubClient,
  type GitHubPullRequestFileApiResponse,
  type PullRequestContext
} from '../../../src/github/pr';
import { paginatedChangedFiles } from '../../fixtures/githubChangedFiles';

function createContextFixture() {
  return {
    repo: {
      owner: 'octo-org',
      repo: 'review-repo'
    },
    payload: {
      pull_request: {
        number: 42,
        title: 'Improve file loading',
        body: 'This updates the file collection flow.',
        user: {
          login: 'contributor'
        },
        base: {
          ref: 'main',
          sha: 'base-sha'
        },
        head: {
          ref: 'feature/task-2',
          sha: 'head-sha'
        }
      }
    }
  };
}

function createMockClient(pages: GitHubPullRequestFileApiResponse[][]): GitHubClient {
  return {
    listPullRequestFiles: vi.fn(async ({ page, perPage }) => {
      expect(perPage).toBe(100);

      return {
        data: pages[page - 1] ?? []
      };
    })
  };
}

describe('getPullRequestMetadata', () => {
  it('returns pull request metadata in an explicit typed shape', () => {
    expect(getPullRequestMetadata(createContextFixture())).toEqual({
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
        ref: 'feature/task-2',
        sha: 'head-sha'
      }
    });
  });
});

describe('collectPullRequestContext', () => {
  it('fetches changed files across all pages and classifies each file safely', async () => {
    const context = createContextFixture();
    const client = createMockClient(paginatedChangedFiles);

    const result = await collectPullRequestContext({
      context,
      client
    });

    expect(result.metadata.pullNumber).toBe(42);
    expect(result.files).toHaveLength(102);
    expect(result.files.slice(0, 2)).toEqual([
      {
        filename: 'src/kept.ts',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'text_patch',
        patch: '@@ -1 +1 @@\n-old\n+new'
      },
      {
        filename: 'docs/image.png',
        status: 'modified',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'missing_patch',
        patch: null
      }
    ]);
    expect(result.files.slice(-2)).toEqual([
      {
        filename: 'src/deleted.ts',
        status: 'removed',
        additions: 1,
        deletions: 10,
        changes: 10,
        kind: 'deleted',
        patch: null
      },
      {
        filename: 'src/renamed.ts',
        status: 'renamed',
        additions: 1,
        deletions: 0,
        changes: 1,
        kind: 'missing_patch',
        patch: null
      }
    ]);

    expect(client.listPullRequestFiles).toHaveBeenCalledTimes(2);
    expect(client.listPullRequestFiles).toHaveBeenNthCalledWith(1, {
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42,
      page: 1,
      perPage: 100
    });
    expect(client.listPullRequestFiles).toHaveBeenNthCalledWith(2, {
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42,
      page: 2,
      perPage: 100
    });
  });

  it('stops after the first page when fewer than 100 files are returned', async () => {
    const context = createContextFixture();
    const firstPageOnly = [
      Array.from({ length: 2 }, (_, index) => ({
        filename: `src/file-${index}.ts`,
        status: 'modified' as const,
        additions: 1,
        deletions: 0,
        changes: 1,
        patch: '@@ -1 +1 @@\n-old\n+new'
      }))
    ];
    const client = createMockClient(firstPageOnly);

    const result = await collectPullRequestContext({
      context,
      client
    });

    expect(result.files).toHaveLength(2);
    expect(client.listPullRequestFiles).toHaveBeenCalledTimes(1);
  });
});
