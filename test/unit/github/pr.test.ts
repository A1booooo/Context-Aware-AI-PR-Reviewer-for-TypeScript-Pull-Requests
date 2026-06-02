import { describe, expect, it, vi } from 'vitest';

import {
  collectPullRequestContext,
  collectPullRequestContextFromRuntime,
  getPullRequestMetadata,
  type GitHubClient,
  type GitHubPullRequestFileApiResponse,
  type PullRequestContext
} from '../../../src/github/pr';
import { createGitHubPullRequestFilesClientFromToken } from '../../../src/github/client';
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

function createRuntimePayloadFixture() {
  return {
    repository: {
      name: 'review-repo',
      owner: {
        login: 'octo-org'
      }
    },
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

describe('collectPullRequestContextFromRuntime', () => {
  it('returns undefined for non pull_request events', async () => {
    const context = await collectPullRequestContextFromRuntime({
      env: {
        GITHUB_EVENT_NAME: 'push'
      },
      readEventFile: vi.fn(),
      createClientFromToken: vi.fn()
    });

    expect(context).toBeUndefined();
  });

  it('builds pull request context from the GitHub Actions runtime inputs', async () => {
    const runtimePayload = createRuntimePayloadFixture();
    const client = createMockClient(paginatedChangedFiles);

    const result = await collectPullRequestContextFromRuntime({
      env: {
        GITHUB_EVENT_NAME: 'pull_request',
        GITHUB_EVENT_PATH: 'event.json',
        GITHUB_TOKEN: 'github-secret-token'
      },
      readEventFile: vi.fn(() => JSON.stringify(runtimePayload)),
      createClientFromToken: vi.fn(() => client)
    });

    expect(result).toEqual<PullRequestContext>({
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
          ref: 'feature/task-2',
          sha: 'head-sha'
        }
      },
      files: expect.any(Array)
    });
    expect(result?.files).toHaveLength(102);
  });

  it('fails clearly when pull_request runtime is missing GITHUB_EVENT_PATH', async () => {
    await expect(
      collectPullRequestContextFromRuntime({
        env: {
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_TOKEN: 'github-secret-token'
        },
        readEventFile: vi.fn(),
        createClientFromToken: vi.fn()
      })
    ).rejects.toThrow(
      'GITHUB_EVENT_PATH is required for pull_request events.'
    );
  });

  it('fails clearly when pull_request runtime is missing GITHUB_TOKEN', async () => {
    await expect(
      collectPullRequestContextFromRuntime({
        env: {
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_EVENT_PATH: 'event.json'
        },
        readEventFile: vi.fn(() => JSON.stringify(createRuntimePayloadFixture())),
        createClientFromToken: vi.fn()
      })
    ).rejects.toThrow(
      'GITHUB_TOKEN is required to collect pull request files for pull_request events.'
    );
  });

  it('fails clearly when the event payload does not contain pull request metadata', async () => {
    await expect(
      collectPullRequestContextFromRuntime({
        env: {
          GITHUB_EVENT_NAME: 'pull_request',
          GITHUB_EVENT_PATH: 'event.json',
          GITHUB_TOKEN: 'github-secret-token'
        },
        readEventFile: vi.fn(() =>
          JSON.stringify({
            repository: {
              name: 'review-repo',
              owner: {
                login: 'octo-org'
              }
            }
          })
        ),
        createClientFromToken: vi.fn()
      })
    ).rejects.toThrow('Pull request payload is missing from the GitHub Action context.');
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

describe('createGitHubPullRequestFilesClientFromToken', () => {
  it('requests the pull request files API with the expected path and headers', async () => {
    const fetchMock = vi.fn(async () => ({
      ok: true,
      json: async () => [
        {
          filename: 'src/kept.ts',
          status: 'modified',
          additions: 1,
          deletions: 0,
          changes: 1,
          patch: '@@ -1 +1 @@\n-old\n+new'
        }
      ]
    }));
    const client = createGitHubPullRequestFilesClientFromToken('github-secret-token', {
      fetch: fetchMock as typeof fetch
    });

    const response = await client.listPullRequestFiles({
      owner: 'octo-org',
      repo: 'review-repo',
      pullNumber: 42,
      page: 2,
      perPage: 100
    });

    expect(response.data).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/octo-org/review-repo/pulls/42/files?page=2&per_page=100',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({
          Accept: 'application/vnd.github+json',
          Authorization: 'Bearer github-secret-token',
          'User-Agent': 'ai-pr-review-assistant'
        })
      })
    );
  });
});
