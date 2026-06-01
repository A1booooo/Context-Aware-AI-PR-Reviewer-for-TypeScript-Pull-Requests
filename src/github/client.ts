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
