import fs from 'node:fs';

import {
  createGitHubPullRequestFilesClientFromToken,
  type PullRequestFilesClient,
  type PullRequestFilesRequest
} from './client';

const FILES_PER_PAGE = 100;

export interface GitHubActionContextLike {
  repo: {
    owner: string;
    repo: string;
  };
  payload: {
    pull_request?: {
      number: number;
      title: string;
      body?: string | null;
      user?: {
        login?: string;
      };
      base: {
        ref: string;
        sha: string;
      };
      head: {
        ref: string;
        sha: string;
      };
    };
  };
}

interface GitHubRuntimeRepositoryPayload {
  name?: string;
  owner?: {
    login?: string;
  };
}

interface GitHubRuntimeEventPayload {
  repository?: GitHubRuntimeRepositoryPayload;
  pull_request?: GitHubActionContextLike['payload']['pull_request'];
}

export interface PullRequestMetadata {
  owner: string;
  repo: string;
  pullNumber: number;
  title: string;
  body: string;
  author: string;
  base: {
    ref: string;
    sha: string;
  };
  head: {
    ref: string;
    sha: string;
  };
}

export interface GitHubPullRequestFileApiResponse {
  filename: string;
  status: 'added' | 'modified' | 'removed' | 'renamed' | 'copied' | 'changed';
  additions: number;
  deletions: number;
  changes: number;
  patch?: string;
}

export type PullRequestChangedFile =
  | PullRequestTextPatchFile
  | PullRequestMissingPatchFile
  | PullRequestDeletedFile;

export interface PullRequestBaseChangedFile {
  filename: string;
  status: GitHubPullRequestFileApiResponse['status'];
  additions: number;
  deletions: number;
  changes: number;
  patch: string | null;
}

export interface PullRequestTextPatchFile extends PullRequestBaseChangedFile {
  kind: 'text_patch';
  patch: string;
}

export interface PullRequestMissingPatchFile extends PullRequestBaseChangedFile {
  kind: 'missing_patch';
  patch: null;
}

export interface PullRequestDeletedFile extends PullRequestBaseChangedFile {
  kind: 'deleted';
  patch: null;
}

export interface PullRequestContext {
  metadata: PullRequestMetadata;
  files: PullRequestChangedFile[];
}

export interface PullRequestFileContent {
  path: string;
  content: string;
}

export interface PullRequestFileContentReader {
  readFile(request: {
    owner: string;
    repo: string;
    ref: string;
    path: string;
  }): Promise<PullRequestFileContent | null>;
}

export interface CollectPullRequestContextOptions {
  context: GitHubActionContextLike;
  client: GitHubClient;
}

export interface CollectPullRequestContextFromRuntimeOptions {
  env?: NodeJS.ProcessEnv;
  readEventFile?: (path: string) => string;
  createClientFromToken?: (token: string) => GitHubClient;
}

export type GitHubClient = PullRequestFilesClient<GitHubPullRequestFileApiResponse>;

export async function collectPullRequestContextFromRuntime(
  options: CollectPullRequestContextFromRuntimeOptions = {}
): Promise<PullRequestContext | void> {
  const env = options.env ?? process.env;
  const eventName = env.GITHUB_EVENT_NAME?.trim();

  if (eventName !== 'pull_request') {
    return undefined;
  }

  const eventPath = env.GITHUB_EVENT_PATH?.trim();

  if (!eventPath) {
    throw new Error('GITHUB_EVENT_PATH is required for pull_request events.');
  }

  const readEventFile = options.readEventFile ?? readGitHubEventFile;
  const rawEventPayload = readEventFile(eventPath);
  const eventPayload = parseGitHubEventPayload(rawEventPayload);
  const context = createGitHubActionContextFromRuntimePayload(eventPayload, env);
  const token = env.GITHUB_TOKEN?.trim();

  if (!token) {
    throw new Error(
      'GITHUB_TOKEN is required to collect pull request files for pull_request events.'
    );
  }

  const createClientFromToken =
    options.createClientFromToken ?? defaultCreateClientFromToken;

  return collectPullRequestContext({
    context,
    client: createClientFromToken(token)
  });
}

export function getPullRequestMetadata(
  context: GitHubActionContextLike
): PullRequestMetadata {
  const pullRequest = context.payload.pull_request;

  if (!pullRequest) {
    throw new Error('Pull request payload is missing from the GitHub Action context.');
  }

  return {
    owner: context.repo.owner,
    repo: context.repo.repo,
    pullNumber: pullRequest.number,
    title: pullRequest.title,
    body: pullRequest.body ?? '',
    author: pullRequest.user?.login ?? 'unknown',
    base: {
      ref: pullRequest.base.ref,
      sha: pullRequest.base.sha
    },
    head: {
      ref: pullRequest.head.ref,
      sha: pullRequest.head.sha
    }
  };
}

export async function collectPullRequestContext(
  options: CollectPullRequestContextOptions
): Promise<PullRequestContext> {
  const metadata = getPullRequestMetadata(options.context);
  const files = await fetchAllPullRequestFiles({
    client: options.client,
    metadata
  });

  return {
    metadata,
    files
  };
}

async function fetchAllPullRequestFiles(options: {
  client: GitHubClient;
  metadata: PullRequestMetadata;
}): Promise<PullRequestChangedFile[]> {
  const files: PullRequestChangedFile[] = [];
  let page = 1;

  while (true) {
    const request: PullRequestFilesRequest = {
      owner: options.metadata.owner,
      repo: options.metadata.repo,
      pullNumber: options.metadata.pullNumber,
      page,
      perPage: FILES_PER_PAGE
    };
    const response = await options.client.listPullRequestFiles(request);

    for (const file of response.data) {
      files.push(classifyPullRequestFile(file));
    }

    if (response.data.length < FILES_PER_PAGE) {
      return files;
    }

    page += 1;
  }
}

function classifyPullRequestFile(
  file: GitHubPullRequestFileApiResponse
): PullRequestChangedFile {
  if (file.status === 'removed') {
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      kind: 'deleted',
      patch: null
    };
  }

  if (typeof file.patch === 'string') {
    return {
      filename: file.filename,
      status: file.status,
      additions: file.additions,
      deletions: file.deletions,
      changes: file.changes,
      kind: 'text_patch',
      patch: file.patch
    };
  }

  return {
    filename: file.filename,
    status: file.status,
    additions: file.additions,
    deletions: file.deletions,
    changes: file.changes,
    kind: 'missing_patch',
    patch: null
  };
}

function readGitHubEventFile(path: string): string {
  try {
    return fs.readFileSync(path, 'utf8');
  } catch {
    throw new Error(`Failed to read GitHub event payload from ${path}.`);
  }
}

function parseGitHubEventPayload(value: string): GitHubRuntimeEventPayload {
  try {
    return JSON.parse(value) as GitHubRuntimeEventPayload;
  } catch {
    throw new Error('GitHub event payload is not valid JSON.');
  }
}

function createGitHubActionContextFromRuntimePayload(
  payload: GitHubRuntimeEventPayload,
  env: NodeJS.ProcessEnv
): GitHubActionContextLike {
  const repository = resolveRuntimeRepository(payload.repository, env);

  return {
    repo: repository,
    payload: {
      pull_request: payload.pull_request
    }
  };
}

function resolveRuntimeRepository(
  repository: GitHubRuntimeRepositoryPayload | undefined,
  env: NodeJS.ProcessEnv
): GitHubActionContextLike['repo'] {
  const owner = repository?.owner?.login?.trim();
  const repo = repository?.name?.trim();

  if (owner && repo) {
    return {
      owner,
      repo
    };
  }

  const repositoryEnv = env.GITHUB_REPOSITORY?.trim();

  if (!repositoryEnv) {
    throw new Error(
      'GitHub event payload is missing repository metadata and GITHUB_REPOSITORY is unavailable.'
    );
  }

  const [envOwner, envRepo] = repositoryEnv.split('/');

  if (!envOwner || !envRepo) {
    throw new Error('GITHUB_REPOSITORY must be in the form "owner/repo".');
  }

  return {
    owner: envOwner,
    repo: envRepo
  };
}

function defaultCreateClientFromToken(token: string): GitHubClient {
  return createGitHubPullRequestFilesClientFromToken<GitHubPullRequestFileApiResponse>(
    token
  );
}
