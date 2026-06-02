"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.publishValidatedInlineComments = publishValidatedInlineComments;
async function publishValidatedInlineComments(options) {
    const publishedFindings = [];
    const downgradedFindings = [];
    for (const finding of options.findings) {
        try {
            await options.client.createPullRequestReviewComment({
                owner: options.metadata.owner,
                repo: options.metadata.repo,
                pullNumber: options.metadata.pullNumber,
                commitId: options.metadata.head.sha,
                path: finding.path,
                line: finding.line,
                side: 'RIGHT',
                body: formatInlineCommentBody(finding)
            });
            publishedFindings.push(finding);
        }
        catch {
            downgradedFindings.push({
                ...finding,
                reason: 'publish_failed'
            });
        }
    }
    return {
        publishedFindings,
        downgradedFindings
    };
}
function formatInlineCommentBody(finding) {
    return `[${finding.severity}] ${finding.title} (confidence ${finding.confidence.toFixed(2)})`;
}
