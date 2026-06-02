import type {
  DowngradedInlineFinding,
  ValidatedInlineFinding
} from '../diff/matchSnippet';
import type { GitHubCommentsClient } from '../github/comments';
import type { PullRequestMetadata } from '../github/pr';

export interface PublishValidatedInlineCommentsOptions {
  metadata: PullRequestMetadata;
  findings: ValidatedInlineFinding[];
  client: GitHubCommentsClient;
}

export interface PublishValidatedInlineCommentsResult {
  publishedFindings: ValidatedInlineFinding[];
  downgradedFindings: DowngradedInlineFinding[];
}

export async function publishValidatedInlineComments(
  options: PublishValidatedInlineCommentsOptions
): Promise<PublishValidatedInlineCommentsResult> {
  const publishedFindings: ValidatedInlineFinding[] = [];
  const downgradedFindings: DowngradedInlineFinding[] = [];

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
    } catch {
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

function formatInlineCommentBody(finding: ValidatedInlineFinding): string {
  return `[${finding.severity}] ${finding.title} (confidence ${finding.confidence.toFixed(2)})`;
}
