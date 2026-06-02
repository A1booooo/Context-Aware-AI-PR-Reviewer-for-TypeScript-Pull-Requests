"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GitHubPullRequestFilesApiError = void 0;
exports.createGitHubPullRequestFilesClientFromEnvironment = createGitHubPullRequestFilesClientFromEnvironment;
exports.createGitHubPullRequestFilesClientFromToken = createGitHubPullRequestFilesClientFromToken;
class GitHubPullRequestFilesApiError extends Error {
    status;
    constructor(status) {
        super(`GitHub pull request files request failed with status ${status}.`);
        this.name = 'GitHubPullRequestFilesApiError';
        this.status = status;
    }
}
exports.GitHubPullRequestFilesApiError = GitHubPullRequestFilesApiError;
function createGitHubPullRequestFilesClientFromEnvironment(options = {}) {
    const token = process.env.GITHUB_TOKEN?.trim();
    if (!token) {
        return null;
    }
    return createGitHubPullRequestFilesClientFromToken(token, options);
}
function createGitHubPullRequestFilesClientFromToken(token, options = {}) {
    const fetchImplementation = options.fetch ?? fetch;
    return {
        async listPullRequestFiles(request) {
            const query = new URLSearchParams({
                page: String(request.page),
                per_page: String(request.perPage)
            });
            const response = await fetchImplementation(`https://api.github.com/repos/${request.owner}/${request.repo}/pulls/${request.pullNumber}/files?${query.toString()}`, {
                method: 'GET',
                headers: {
                    Accept: 'application/vnd.github+json',
                    Authorization: `Bearer ${token}`,
                    'User-Agent': 'ai-pr-review-assistant'
                }
            });
            if (!response.ok) {
                throw new GitHubPullRequestFilesApiError(response.status);
            }
            return {
                data: (await response.json())
            };
        }
    };
}
