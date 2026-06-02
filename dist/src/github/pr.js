"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectPullRequestContextFromRuntime = collectPullRequestContextFromRuntime;
exports.getPullRequestMetadata = getPullRequestMetadata;
exports.collectPullRequestContext = collectPullRequestContext;
const node_fs_1 = __importDefault(require("node:fs"));
const client_1 = require("./client");
const FILES_PER_PAGE = 100;
async function collectPullRequestContextFromRuntime(options = {}) {
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
        throw new Error('GITHUB_TOKEN is required to collect pull request files for pull_request events.');
    }
    const createClientFromToken = options.createClientFromToken ?? defaultCreateClientFromToken;
    return collectPullRequestContext({
        context,
        client: createClientFromToken(token)
    });
}
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
function readGitHubEventFile(path) {
    try {
        return node_fs_1.default.readFileSync(path, 'utf8');
    }
    catch {
        throw new Error(`Failed to read GitHub event payload from ${path}.`);
    }
}
function parseGitHubEventPayload(value) {
    try {
        return JSON.parse(value);
    }
    catch {
        throw new Error('GitHub event payload is not valid JSON.');
    }
}
function createGitHubActionContextFromRuntimePayload(payload, env) {
    const repository = resolveRuntimeRepository(payload.repository, env);
    return {
        repo: repository,
        payload: {
            pull_request: payload.pull_request
        }
    };
}
function resolveRuntimeRepository(repository, env) {
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
        throw new Error('GitHub event payload is missing repository metadata and GITHUB_REPOSITORY is unavailable.');
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
function defaultCreateClientFromToken(token) {
    return (0, client_1.createGitHubPullRequestFilesClientFromToken)(token);
}
