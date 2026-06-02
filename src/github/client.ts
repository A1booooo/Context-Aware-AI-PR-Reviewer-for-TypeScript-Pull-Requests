export interface GitHubPullRequestFilesPage<TFile> {
  data: TFile[];
}

export interface PullRequestFilesRequest {
  owner: string;
  repo: string;
  pullNumber: number;
  page: number;
  perPage: number;
}

export interface PullRequestFilesClient<TFile> {
  listPullRequestFiles(
    request: PullRequestFilesRequest
  ): Promise<GitHubPullRequestFilesPage<TFile>>;
}

export class GitHubPullRequestFilesApiError extends Error {
  readonly status: number;

  constructor(status: number) {
    super(`GitHub pull request files request failed with status ${status}.`);
    this.name = 'GitHubPullRequestFilesApiError';
    this.status = status;
  }
}

export interface GitHubIssueCommentApiResponse {
  id: number;
  body?: string | null;
  user?: {
    login?: string;
    type?: string;
  };
}

export interface GitHubPullRequestReviewCommentApiResponse {
  id: number;
  body?: string | null;
  path?: string | null;
  line?: number | null;
  user?: {
    login?: string;
    type?: string;
  };
}

export interface GitHubIssueCommentsPage<TComment> {
  data: TComment[];
}

export interface PullRequestCommentsRequest {
  owner: string;
  repo: string;
  pullNumber: number;
}

export interface CreateIssueCommentRequest {
  owner: string;
  repo: string;
  issueNumber: number;
  body: string;
}

export interface UpdateIssueCommentRequest {
  owner: string;
  repo: string;
  commentId: number;
  body: string;
}

export interface CreatePullRequestReviewCommentRequest {
  owner: string;
  repo: string;
  pullNumber: number;
  commitId: string;
  path: string;
  line: number;
  side: 'RIGHT';
  body: string;
}

export interface PullRequestCommentsClient<TComment> {
  listPullRequestComments(
    request: PullRequestCommentsRequest
  ): Promise<GitHubIssueCommentsPage<TComment>>;
  createIssueComment(
    request: CreateIssueCommentRequest
  ): Promise<TComment>;
  updateIssueComment(
    request: UpdateIssueCommentRequest
  ): Promise<TComment>;
}

export interface PullRequestReviewCommentsClient<TReviewComment> {
  createPullRequestReviewComment(
    request: CreatePullRequestReviewCommentRequest
  ): Promise<TReviewComment>;
}

export function createGitHubPullRequestFilesClientFromEnvironment<
  TFile extends object = Record<string, unknown>
>(
  options: {
    fetch?: typeof fetch;
  } = {}
): PullRequestFilesClient<TFile> | null {
  const token = process.env.GITHUB_TOKEN?.trim();

  if (!token) {
    return null;
  }

  return createGitHubPullRequestFilesClientFromToken(token, options);
}

export function createGitHubPullRequestFilesClientFromToken<
  TFile extends object = Record<string, unknown>
>(
  token: string,
  options: {
    fetch?: typeof fetch;
  } = {}
): PullRequestFilesClient<TFile> {
  const fetchImplementation = options.fetch ?? fetch;

  return {
    async listPullRequestFiles(request) {
      const query = new URLSearchParams({
        page: String(request.page),
        per_page: String(request.perPage)
      });
      const response = await fetchImplementation(
        `https://api.github.com/repos/${request.owner}/${request.repo}/pulls/${request.pullNumber}/files?${query.toString()}`,
        {
          method: 'GET',
          headers: {
            Accept: 'application/vnd.github+json',
            Authorization: `Bearer ${token}`,
            'User-Agent': 'ai-pr-review-assistant'
          }
        }
      );

      if (!response.ok) {
        throw new GitHubPullRequestFilesApiError(response.status);
      }

      return {
        data: (await response.json()) as TFile[]
      };
    }
  };
}
