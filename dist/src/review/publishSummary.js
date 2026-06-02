"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishDeterministicSummary = publishDeterministicSummary;
const comments_1 = require("../github/comments");
const formatSummary_1 = require("./formatSummary");
async function publishDeterministicSummary(options) {
    const body = (0, formatSummary_1.formatDeterministicSummaryComment)({
        metadata: options.metadata,
        includedFiles: options.includedFiles,
        excludedFiles: options.excludedFiles,
        reviewContext: options.reviewContext,
        aiReview: options.aiReview
    });
    return (0, comments_1.upsertPullRequestCommentByMarker)({
        owner: options.metadata.owner,
        repo: options.metadata.repo,
        pullNumber: options.metadata.pullNumber,
        marker: formatSummary_1.DETERMINISTIC_SUMMARY_MARKER,
        body,
        client: options.client
    });
}
