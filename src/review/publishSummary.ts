import type { ExcludedDiffFile, IncludedDiffFile } from '../diff/filterFiles';
import {
  type GitHubCommentsClient,
  upsertPullRequestCommentByMarker
} from '../github/comments';
import type { ReviewContextMetadata } from '../context/buildReviewContext';
import type { DowngradedInlineFinding } from '../diff/matchSnippet';
import type { PullRequestMetadata } from '../github/pr';

import {
  DETERMINISTIC_SUMMARY_MARKER,
  formatDeterministicSummaryComment,
  type SummaryAiReview
} from './formatSummary';

export interface PublishDeterministicSummaryOptions {
  metadata: PullRequestMetadata;
  includedFiles: IncludedDiffFile[];
  excludedFiles: ExcludedDiffFile[];
  reviewContext?: ReviewContextMetadata;
  aiReview?: SummaryAiReview;
  downgradedInlineFindings?: DowngradedInlineFinding[];
  client: GitHubCommentsClient;
}

export async function publishDeterministicSummary(
  options: PublishDeterministicSummaryOptions
) {
  const body = formatDeterministicSummaryComment({
    metadata: options.metadata,
    includedFiles: options.includedFiles,
    excludedFiles: options.excludedFiles,
    reviewContext: options.reviewContext,
    aiReview: options.aiReview,
    downgradedInlineFindings: options.downgradedInlineFindings
  });

  return upsertPullRequestCommentByMarker({
    owner: options.metadata.owner,
    repo: options.metadata.repo,
    pullNumber: options.metadata.pullNumber,
    marker: DETERMINISTIC_SUMMARY_MARKER,
    body,
    client: options.client
  });
}
