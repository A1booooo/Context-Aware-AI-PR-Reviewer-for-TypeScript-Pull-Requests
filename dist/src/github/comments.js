"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGitHubCommentsClientFromEnvironment = createGitHubCommentsClientFromEnvironment;
exports.createGitHubCommentsClientFromToken = createGitHubCommentsClientFromToken;
exports.listPullRequestComments = listPullRequestComments;
exports.upsertPullRequestCommentByMarker = upsertPullRequestCommentByMarker;
function createGitHubCommentsClientFromEnvironment() {
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
        return null;
    }
    return createGitHubCommentsClientFromToken(token);
}
function createGitHubCommentsClientFromToken(token) {
    return {
        async listPullRequestComments(request) {
            return {
                data: await requestGitHubCommentsApi({
                    token,
                    method: 'GET',
                    path: buildPullRequestCommentsPath(request)
                })
            };
        },
        createIssueComment(request) {
            return requestGitHubCommentsApi({
                token,
                method: 'POST',
                path: buildIssueCommentsPath(request),
                body: {
                    body: request.body
                }
            });
        },
        updateIssueComment(request) {
            return requestGitHubCommentsApi({
                token,
                method: 'PATCH',
                path: buildIssueCommentUpdatePath(request),
                body: {
                    body: request.body
                }
            });
        }
    };
}
async function listPullRequestComments(options) {
    const response = await options.client.listPullRequestComments({
        owner: options.owner,
        repo: options.repo,
        pullNumber: options.pullNumber
    });
    return response.data.map(normalizeComment);
}
async function upsertPullRequestCommentByMarker(options) {
    const comments = await listPullRequestComments(options);
    const existingComment = findMarkerBotComment(comments, options.marker);
    if (existingComment) {
        const updatedComment = normalizeComment(await options.client.updateIssueComment({
            owner: options.owner,
            repo: options.repo,
            commentId: existingComment.id,
            body: options.body
        }));
        return {
            action: 'updated',
            comment: updatedComment
        };
    }
    const createdComment = normalizeComment(await options.client.createIssueComment({
        owner: options.owner,
        repo: options.repo,
        issueNumber: options.pullNumber,
        body: options.body
    }));
    return {
        action: 'created',
        comment: createdComment
    };
}
function findMarkerBotComment(comments, marker) {
    return comments.find((comment) => comment.authorType === 'Bot' && comment.body.includes(marker));
}
function normalizeComment(comment) {
    return {
        id: comment.id,
        body: comment.body ?? '',
        authorLogin: comment.user?.login ?? 'unknown',
        authorType: comment.user?.type ?? 'Unknown'
    };
}
async function requestGitHubCommentsApi(options) {
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
        throw new Error(`GitHub comments request failed with status ${response.status}.`);
    }
    return (await response.json());
}
function buildPullRequestCommentsPath(request) {
    return `/repos/${request.owner}/${request.repo}/issues/${request.pullNumber}/comments`;
}
function buildIssueCommentsPath(request) {
    return `/repos/${request.owner}/${request.repo}/issues/${request.issueNumber}/comments`;
}
function buildIssueCommentUpdatePath(request) {
    return `/repos/${request.owner}/${request.repo}/issues/comments/${request.commentId}`;
}
