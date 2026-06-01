"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPullRequestMetadata = getPullRequestMetadata;
exports.collectPullRequestContext = collectPullRequestContext;
const FILES_PER_PAGE = 100;
function getPullRequestMetadata(context) {
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
async function collectPullRequestContext(options) {
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
async function fetchAllPullRequestFiles(options) {
    const files = [];
    let page = 1;
    while (true) {
        const request = {
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
function classifyPullRequestFile(file) {
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
