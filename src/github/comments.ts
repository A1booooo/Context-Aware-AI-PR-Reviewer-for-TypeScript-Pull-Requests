import type {
  CreatePullRequestReviewCommentRequest,
  CreateIssueCommentRequest,
  GitHubIssueCommentApiResponse,
  GitHubPullRequestReviewCommentApiResponse,
  PullRequestCommentsClient,
  PullRequestReviewCommentsClient,
  PullRequestCommentsRequest,
  UpdateIssueCommentRequest
} from './client';

export interface PullRequestComment {
  id: number;
  body: string;
  authorLogin: string;
  authorType: string;
}

export class GitHubCommentsApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`GitHub comments request failed with status ${status}.`);
    this.name = 'GitHubCommentsApiError';
    this.status = status;
  }
}

export interface ListPullRequestCommentsOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  client: GitHubCommentsClient;
}

export interface UpsertPullRequestCommentByMarkerOptions {
  owner: string;
  repo: string;
  pullNumber: number;
  marker: string;
  body: string;
  client: GitHubCommentsClient;
}

export interface UpsertPullRequestCommentByMarkerResult {
  action: 'created' | 'updated';
  comment: PullRequestComment;
}

export type GitHubCommentsClient =
  PullRequestCommentsClient<GitHubIssueCommentApiResponse> &
  PullRequestReviewCommentsClient<GitHubPullRequestReviewCommentApiResponse>;

export function createGitHubCommentsClientFromEnvironment():
  | GitHubCommentsClient
  | null {
  const token = process.env.GITHUB_TOKEN;

  if (!token) {
    return null;
  }

  return createGitHubCommentsClientFromToken(token);
}

export function createGitHubCommentsClientFromToken(
  token: string
): GitHubCommentsClient {
  return {
    async listPullRequestComments(request) {
      return {
        data: await requestGitHubCommentsApi<GitHubIssueCommentApiResponse[]>({
          token,
          method: 'GET',
          path: buildPullRequestCommentsPath(request)
        })
      };
    },
    createIssueComment(request) {
      return requestGitHubCommentsApi<GitHubIssueCommentApiResponse>({
        token,
        method: 'POST',
        path: buildIssueCommentsPath(request),
        body: {
          body: request.body
        }
      });
    },
    updateIssueComment(request) {
      return requestGitHubCommentsApi<GitHubIssueCommentApiResponse>({
        token,
        method: 'PATCH',
        path: buildIssueCommentUpdatePath(request),
        body: {
          body: request.body
        }
      });
    },
    createPullRequestReviewComment(request) {
      return requestGitHubCommentsApi<GitHubPullRequestReviewCommentApiResponse>({
        token,
        method: 'POST',
        path: buildPullRequestReviewCommentsPath(request),
        body: {
          body: request.body,
          commit_id: request.commitId,
          path: request.path,
          line: request.line,
          side: request.side
        }
      });
    }
  };
}

export async function listPullRequestComments(
  options: ListPullRequestCommentsOptions
): Promise<PullRequestComment[]> {
  const response = await options.client.listPullRequestComments({
    owner: options.owner,
    repo: options.repo,
    pullNumber: options.pullNumber
  });

  return response.data.map(normalizeComment);
}

export async function upsertPullRequestCommentByMarker(
  options: UpsertPullRequestCommentByMarkerOptions
): Promise<UpsertPullRequestCommentByMarkerResult> {
  const comments = await listPullRequestComments(options);
  const existingComment = findMarkerBotComment(comments, options.marker);

  if (existingComment) {
    const updatedComment = normalizeComment(
      await options.client.updateIssueComment({
        owner: options.owner,
        repo: options.repo,
        commentId: existingComment.id,
        body: options.body
      })
    );

    return {
      action: 'updated',
      comment: updatedComment
    };
  }

  const createdComment = normalizeComment(
    await options.client.createIssueComment({
      owner: options.owner,
      repo: options.repo,
      issueNumber: options.pullNumber,
      body: options.body
    })
  );

  return {
    action: 'created',
    comment: createdComment
  };
}

function findMarkerBotComment(
  comments: PullRequestComment[],
  marker: string
): PullRequestComment | undefined {
  return comments.find(
    (comment) => comment.authorType === 'Bot' && comment.body.includes(marker)
  );
}

function normalizeComment(
  comment: GitHubIssueCommentApiResponse
): PullRequestComment {
  return {
    id: comment.id,
    body: comment.body ?? '',
    authorLogin: comment.user?.login ?? 'unknown',
    authorType: comment.user?.type ?? 'Unknown'
  };
}

async function requestGitHubCommentsApi<T>(options: {
  token: string;
  method: 'GET' | 'POST' | 'PATCH';
  path: string;
  body?: Record<string, number | string>;
}): Promise<T> {
  const response = await fetch(`https://api.github.com${options.path}`, {
    method: options.method,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${options.token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'ai-pr-review-assistant'
    },
    body: options.body ? JSON.stringify(options.body) : undefined
  });

  if (!response.ok) {
    throw new GitHubCommentsApiError(response.status);
  }

  return (await response.json()) as T;
}

function buildPullRequestCommentsPath(
  request: PullRequestCommentsRequest
): string {
  return `/repos/${request.owner}/${request.repo}/issues/${request.pullNumber}/comments`;
}

function buildIssueCommentsPath(request: CreateIssueCommentRequest): string {
  return `/repos/${request.owner}/${request.repo}/issues/${request.issueNumber}/comments`;
}

function buildIssueCommentUpdatePath(request: UpdateIssueCommentRequest): string {
  return `/repos/${request.owner}/${request.repo}/issues/comments/${request.commentId}`;
}

function buildPullRequestReviewCommentsPath(
  request: CreatePullRequestReviewCommentRequest
): string {
  return `/repos/${request.owner}/${request.repo}/pulls/${request.pullNumber}/comments`;
}
